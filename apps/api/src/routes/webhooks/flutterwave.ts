import { parseFlwWebhook, FLW_HEADER } from '@fayapay/flutterwave';
import { WebhookSignatureError } from '@fayapay/shared';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function flutterwaveWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/flutterwave',
    config: { rawBody: true },
    handler: async (req, reply) => {
      try {
        const event = parseFlwWebhook({
          rawBody: req.rawBody as Buffer,
          verifHash: req.headers[FLW_HEADER] as string,
        });
        const ref =
          (event.data as { tx_ref?: string; reference?: string; id?: number }).tx_ref ??
          (event.data as { reference?: string }).reference ??
          String((event.data as { id?: number }).id ?? '');
        await persistAndQueue({
          provider: 'flutterwave',
          providerEventId: `${event.event}:${ref}`,
          eventType: event.event,
          signatureValid: true,
          payload: event,
          headers: req.headers,
          queue: app.queues.webhookEvents,
        });
        return reply.code(200).send();
      } catch (err) {
        if (err instanceof WebhookSignatureError) return reply.code(401).send({ error: 'invalid_signature' });
        throw err;
      }
    },
  });
}
