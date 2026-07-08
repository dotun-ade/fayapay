import { parseDojahWebhook, DOJAH_HEADER } from '@fayapay/dojah';
import { WebhookSignatureError } from '@fayapay/shared';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function dojahWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/dojah',
    config: { rawBody: true },
    handler: async (req, reply) => {
      try {
        const event = parseDojahWebhook({
          rawBody: req.rawBody as Buffer,
          signature: req.headers[DOJAH_HEADER] as string,
        });
        await persistAndQueue({
          provider: 'dojah',
          providerEventId: event.reference,
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
