import { prisma, KycType } from '@fayapay/db';
import { ValidationError, logger } from '@fayapay/shared';
import { DojahClient } from '@fayapay/dojah';
import type { Queue } from 'bullmq';

interface DispatchInput {
  cardholderId: string;
  country: string;
  identification: { type: 'BVN' | 'NIN' | 'PASSPORT' | 'DRIVERS_LICENSE'; number: string };
  selfieBase64?: string;
  queue: Queue;
}

/**
 * Dispatch a KYC check via Dojah.
 *
 * Dojah is our sole identity vendor. It covers Nigerian BVN, NIN, and CAC
 * (business). For non-BVN/NIN id types, we mark the record IN_REVIEW and
 * escalate to manual ops — there is no automated path until a second vendor
 * is signed.
 */
export async function dispatchKyc(input: DispatchInput) {
  const cardholder = await prisma.cardholder.findUnique({
    where: { id: input.cardholderId },
  });
  if (!cardholder) throw new ValidationError(`Unknown cardholder ${input.cardholderId}`);

  const record = await prisma.kycRecord.create({
    data: {
      cardholderId: input.cardholderId,
      provider: 'dojah',
      type: input.identification.type as KycType,
      status: 'PENDING',
    },
  });
  await prisma.cardholder.update({
    where: { id: input.cardholderId },
    data: { kycStatus: 'IN_REVIEW' },
  });

  if (input.identification.type !== 'BVN' && input.identification.type !== 'NIN') {
    await prisma.kycRecord.update({
      where: { id: record.id },
      data: {
        status: 'IN_REVIEW',
        rejectionReason: 'Manual review: id type unsupported by Dojah lookup',
      },
    });
    await input.queue.add('escalate-manual-review', { kycRecordId: record.id });
    return prisma.kycRecord.findUnique({ where: { id: record.id } });
  }

  try {
    const dojah = new DojahClient();
    const data =
      input.identification.type === 'BVN'
        ? await dojah.lookupBvn(input.identification.number)
        : await dojah.lookupNin(input.identification.number);
    const approved = matchNames(cardholder, data as Record<string, unknown>);
    await prisma.kycRecord.update({
      where: { id: record.id },
      data: {
        status: approved ? 'APPROVED' : 'IN_REVIEW',
        raw: data as never,
        providerRef: input.identification.number,
      },
    });
    if (approved) {
      await prisma.cardholder.update({
        where: { id: input.cardholderId },
        data: { kycStatus: 'APPROVED', kycTier: 1 },
      });
    } else {
      await input.queue.add('escalate-manual-review', { kycRecordId: record.id });
    }
  } catch (err) {
    logger.error({ err, recordId: record.id }, 'KYC dispatch failed');
    await prisma.kycRecord.update({
      where: { id: record.id },
      data: {
        status: 'PENDING',
        rejectionReason: (err as Error).message,
        attempts: { increment: 1 },
      },
    });
    await input.queue.add('retry-kyc', { recordId: record.id }, { delay: 60_000 });
  }

  return prisma.kycRecord.findUnique({ where: { id: record.id } });
}

function matchNames(
  cardholder: { firstName: string; lastName: string },
  data: Record<string, unknown>,
): boolean {
  const first = String(data['first_name'] ?? data['firstname'] ?? '').toLowerCase();
  const last = String(data['last_name'] ?? data['surname'] ?? '').toLowerCase();
  return cardholder.firstName.toLowerCase() === first && cardholder.lastName.toLowerCase() === last;
}
