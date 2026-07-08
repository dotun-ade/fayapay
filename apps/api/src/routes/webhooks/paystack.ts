import { parsePaystackWebhook, PAYSTACK_HEADER } from '@fayapay/paystack';
import { WebhookSignatureError } from '@fayapay/shared';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function paystackWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/paystack',
    config: { rawBody: true },
    handler: async (req, reply) => {
      try {
        const event = parsePaystackWebhook({
          rawBody: req.rawBody as Buffer,
          signature: req.headers[PAYSTACK_HEADER] as string,
        });
        // Paystack doesn't include an event id — derive from payload hash + reference.
        const ref =
          (event.data as { reference?: string }).reference ??
          (event.data as { transfer_code?: string }).transfer_code ??
          createHash('sha256').update(req.rawBody as Buffer).digest('hex');
        await persistAndQueue({
          provider: 'paystack',
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
