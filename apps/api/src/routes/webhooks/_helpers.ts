import { prisma } from '@fayapay/db';
import { logger, webhookDedupeKey } from '@fayapay/shared';
import type { Queue } from 'bullmq';

/**
 * Persist a webhook event idempotently and enqueue for async processing.
 * Returns true if new, false if duplicate.
 */
export async function persistAndQueue(input: {
  provider: string;
  providerEventId: string;
  eventType: string;
  signatureValid: boolean;
  payload: unknown;
  headers: Record<string, unknown>;
  queue: Queue;
}): Promise<{ isNew: boolean; id: string }> {
  try {
    const ev = await prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        signatureValid: input.signatureValid,
        payload: input.payload as never,
        headers: input.headers as never,
      },
    });
    await input.queue.add(
      `${input.provider}:${input.eventType}`,
      { webhookEventId: ev.id },
      { jobId: webhookDedupeKey(input.provider, input.providerEventId) },
    );
    return { isNew: true, id: ev.id };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      logger.info(
        { provider: input.provider, providerEventId: input.providerEventId },
        'duplicate webhook',
      );
      const existing = await prisma.webhookEvent.findUnique({
        where: { provider_providerEventId: { provider: input.provider, providerEventId: input.providerEventId } },
      });
      return { isNew: false, id: existing!.id };
    }
    throw err;
  }
}
