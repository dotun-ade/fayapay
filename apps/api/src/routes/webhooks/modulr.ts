import { parseModulrWebhook, MODULR_HEADER } from '@fayapay/modulr';
import { WebhookSignatureError } from '@fayapay/shared';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function modulrWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/modulr',
    config: { rawBody: true },
    handler: async (req, reply) => {
      try {
        const event = parseModulrWebhook({
          rawBody: req.rawBody as Buffer,
          signature: req.headers[MODULR_HEADER] as string,
        });
        const evId = createHash('sha256').update(req.rawBody as Buffer).digest('hex');
        await persistAndQueue({
          provider: 'modulr',
          providerEventId: evId,
          eventType: event.type,
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
