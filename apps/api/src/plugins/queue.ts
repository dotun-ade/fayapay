import fp from 'fastify-plugin';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { optionalEnv } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: IORedis;
    queues: {
      webhookEvents: Queue;
      payouts: Queue;
      cardEvents: Queue;
      kycPolling: Queue;
      recon: Queue;
    };
  }
}

const prefix = optionalEnv('QUEUE_PREFIX', 'fayapay')!;

const plugin: FastifyPluginAsync = async (app) => {
  const redis = new IORedis(optionalEnv('REDIS_URL', 'redis://localhost:6379')!, {
    maxRetriesPerRequest: null,
  });
  app.decorate('redis', redis);

  const q = (name: string) =>
    new Queue(name, { connection: redis, prefix, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } } });

  app.decorate('queues', {
    webhookEvents: q('webhook-events'),
    payouts: q('payouts'),
    cardEvents: q('card-events'),
    kycPolling: q('kyc-polling'),
    recon: q('recon'),
  });

  app.addHook('onClose', async () => {
    await Promise.all([
      app.queues.webhookEvents.close(),
      app.queues.payouts.close(),
      app.queues.cardEvents.close(),
      app.queues.kycPolling.close(),
      app.queues.recon.close(),
    ]);
    await redis.quit();
  });
};

export const queuePlugin = fp(plugin, { name: 'queue' });
