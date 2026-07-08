import IORedis from 'ioredis';
import { Worker, type Job } from 'bullmq';
import { logger, optionalEnv } from '@fayapay/shared';
import { processWebhookEvent } from './consumers/webhooks.js';
import { processPayout } from './consumers/payouts.js';
import { processCardEvent } from './consumers/cards.js';
import { processKycPoll } from './consumers/kyc.js';
import { processRecon } from './consumers/recon.js';

const connection = new IORedis(optionalEnv('REDIS_URL', 'redis://localhost:6379')!, {
  maxRetriesPerRequest: null,
});
const prefix = optionalEnv('QUEUE_PREFIX', 'fayapay')!;

const workers = [
  new Worker('webhook-events', wrap(processWebhookEvent), { connection, prefix, concurrency: 16 }),
  new Worker('payouts', wrap(processPayout), { connection, prefix, concurrency: 8 }),
  new Worker('card-events', wrap(processCardEvent), { connection, prefix, concurrency: 8 }),
  new Worker('kyc-polling', wrap(processKycPoll), { connection, prefix, concurrency: 4 }),
  new Worker('recon', wrap(processRecon), { connection, prefix, concurrency: 2 }),
];

function wrap<T>(fn: (job: Job<T>) => Promise<unknown>) {
  return async (job: Job<T>) => {
    const start = Date.now();
    try {
      const out = await fn(job);
      logger.info({ queue: job.queueName, jobId: job.id, ms: Date.now() - start }, 'job done');
      return out;
    } catch (err) {
      logger.error(
        { queue: job.queueName, jobId: job.id, err, ms: Date.now() - start },
        'job failed',
      );
      throw err;
    }
  };
}

for (const w of workers) {
  w.on('failed', (job, err) => {
    logger.warn({ queue: w.name, jobId: job?.id, err: err.message }, 'job retry');
  });
}

logger.info({ queues: workers.map((w) => w.name) }, 'fayapay-worker up');

async function shutdown() {
  logger.info('shutting down workers');
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
