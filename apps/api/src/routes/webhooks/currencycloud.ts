import { parseCcWebhook, CC_HEADER_SIGNATURE } from '@fayapay/currencycloud';
import { WebhookSignatureError } from '@fayapay/shared';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function currencycloudWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/currencycloud',
    config: { rawBody: true },
    handler: async (req, reply) => {
      try {
        const event = parseCcWebhook({
          rawBody: req.rawBody as Buffer,
          signature: req.headers[CC_HEADER_SIGNATURE] as string,
        });
        await persistAndQueue({
          provider: 'currencycloud',
          providerEventId: event.notification_id,
          eventType: event.notification_type,
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
