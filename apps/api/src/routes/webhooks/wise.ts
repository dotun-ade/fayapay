import {
  parseWiseWebhook,
  WISE_HEADER_DELIVERY,
  WISE_HEADER_SIGNATURE,
  WISE_HEADER_TEST,
} from '@fayapay/wise';
import { WebhookSignatureError } from '@fayapay/shared';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function wiseWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/wise',
    config: { rawBody: true },
    handler: async (req, reply) => {
      // Wise sends synthetic test events on creation. Acknowledge and skip.
      if (req.headers[WISE_HEADER_TEST] === 'true') return reply.code(200).send();
      try {
        const event = parseWiseWebhook({
          rawBody: req.rawBody as Buffer,
          signatureBase64: req.headers[WISE_HEADER_SIGNATURE] as string,
        });
        const deliveryId = (req.headers[WISE_HEADER_DELIVERY] as string) ?? event.data.resource.id.toString();
        await persistAndQueue({
          provider: 'wise',
          providerEventId: deliveryId,
          eventType: event.event_type,
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
