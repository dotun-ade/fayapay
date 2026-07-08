import { prisma, WebhookEvent } from '@fayapay/db';
import { logger } from '@fayapay/shared';

interface DojahPayload {
  event: string;
  reference: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function handleDojah(ev: WebhookEvent) {
  const payload = ev.payload as unknown as DojahPayload;
  const record = await prisma.kycRecord.findFirst({
    where: { provider: 'dojah', providerRef: payload.reference },
  });
  if (!record) {
    logger.warn({ ref: payload.reference }, 'dojah webhook for unknown record');
    return;
  }
  const verified = payload.event === 'kyc.completed' || payload.event === 'identity.verified';
  const rejected = payload.event === 'kyc.failed';
  await prisma.kycRecord.update({
    where: { id: record.id },
    data: {
      status: verified ? 'APPROVED' : rejected ? 'REJECTED' : 'IN_REVIEW',
      raw: payload as never,
    },
  });
  if (verified) {
    await prisma.cardholder.update({
      where: { id: record.cardholderId },
      data: { kycStatus: 'APPROVED', kycTier: 1 },
    });
  } else if (rejected) {
    await prisma.cardholder.update({
      where: { id: record.cardholderId },
      data: { kycStatus: 'REJECTED' },
    });
  }
}
