import { prisma } from '@fayapay/db';
import { logger } from '@fayapay/shared';
import type { Job } from 'bullmq';
import { handleSudo } from '../handlers/sudo.js';
import { handlePaystack } from '../handlers/paystack.js';
import { handleFlutterwave } from '../handlers/flutterwave.js';
import { handleWise } from '../handlers/wise.js';
import { handleDojah } from '../handlers/dojah.js';

/**
 * Webhook event consumer. One job per persisted webhook_event row.
 * Dispatches to a per-provider handler. Marks the row processed_at on success.
 */
export async function processWebhookEvent(job: Job<{ webhookEventId: string }>) {
  const ev = await prisma.webhookEvent.findUnique({ where: { id: job.data.webhookEventId } });
  if (!ev) {
    logger.warn({ id: job.data.webhookEventId }, 'webhook event missing');
    return;
  }
  if (ev.processedAt) return;

  try {
    switch (ev.provider) {
      case 'sudo':
        await handleSudo(ev);
        break;
      case 'paystack':
        await handlePaystack(ev);
        break;
      case 'flutterwave':
        await handleFlutterwave(ev);
        break;
      case 'wise':
        await handleWise(ev);
        break;
      case 'dojah':
        await handleDojah(ev);
        break;
      default:
        logger.info({ provider: ev.provider, type: ev.eventType }, 'no handler — acked');
    }
    await prisma.webhookEvent.update({
      where: { id: ev.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: ev.id },
      data: { attempts: { increment: 1 }, lastError: (err as Error).message },
    });
    throw err;
  }
}
