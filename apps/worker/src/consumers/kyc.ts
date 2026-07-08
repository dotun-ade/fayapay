import { prisma } from '@fayapay/db';
import { logger } from '@fayapay/shared';
import { DojahClient } from '@fayapay/dojah';
import type { Job } from 'bullmq';

export async function processKycPoll(job: Job<{ recordId: string }>) {
  const record = await prisma.kycRecord.findUnique({ where: { id: job.data.recordId } });
  if (!record || record.status === 'APPROVED' || record.status === 'REJECTED') return;

  if (job.name === 'retry-kyc') {
    const cardholder = await prisma.cardholder.findUnique({
      where: { id: record.cardholderId },
    });
    if (!cardholder || !record.providerRef) return;
    const dojah = new DojahClient();
    try {
      const data =
        record.type === 'NIN'
          ? await dojah.lookupNin(record.providerRef)
          : await dojah.lookupBvn(record.providerRef);
      const first = String(
        (data as Record<string, unknown>)['first_name'] ??
          (data as Record<string, unknown>)['firstname'] ??
          '',
      ).toLowerCase();
      const last = String(
        (data as Record<string, unknown>)['last_name'] ??
          (data as Record<string, unknown>)['surname'] ??
          '',
      ).toLowerCase();
      const approved =
        cardholder.firstName.toLowerCase() === first &&
        cardholder.lastName.toLowerCase() === last;
      await prisma.kycRecord.update({
        where: { id: record.id },
        data: { status: approved ? 'APPROVED' : 'IN_REVIEW', raw: data as never },
      });
      if (approved) {
        await prisma.cardholder.update({
          where: { id: record.cardholderId },
          data: { kycStatus: 'APPROVED', kycTier: 1 },
        });
      }
    } catch (err) {
      logger.error({ err, recordId: record.id }, 'kyc retry failed');
      throw err;
    }
    return;
  }

  if (job.name === 'escalate-manual-review') {
    logger.warn({ recordId: record.id }, 'KYC needs human review');
  }
}
