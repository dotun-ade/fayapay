import { parseSudoWebhook, SUDO_WEBHOOK_HEADER } from '@fayapay/sudo';
import { WebhookSignatureError } from '@fayapay/shared';
import type { FastifyInstance } from 'fastify';
import { persistAndQueue } from './_helpers.js';

export async function sudoWebhook(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/sudo',
    config: { rawBody: true },
    handler: async (req, reply) => {
      const signature = req.headers[SUDO_WEBHOOK_HEADER] as string;
      const raw = req.rawBody as Buffer;
      try {
        const event = parseSudoWebhook({ rawBody: raw, signature });
        await persistAndQueue({
          provider: 'sudo',
          providerEventId: `${event.type}:${event.createdAt}:${JSON.stringify(event.data).slice(0, 60)}`,
          eventType: event.type,
          signatureValid: true,
          payload: event,
          headers: req.headers,
          queue: app.queues.webhookEvents,
        });
        return reply.code(200).send({ received: true });
      } catch (err) {
        if (err instanceof WebhookSignatureError) return reply.code(401).send({ error: 'invalid_signature' });
        throw err;
      }
    },
  });
}
