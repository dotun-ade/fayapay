import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';
import rawBody from 'fastify-raw-body';
import { logger, requiredEnv, optionalEnv, FayapayError } from '@fayapay/shared';
import { authPlugin } from './plugins/auth.js';
import { queuePlugin } from './plugins/queue.js';
import { errorHandler } from './plugins/error-handler.js';
import { registerRoutes } from './routes/index.js';

export async function buildServer() {
  const app = Fastify({
    logger: false,
    bodyLimit: 5 * 1024 * 1024,
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler(errorHandler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: optionalEnv('CORS_ORIGINS', '*')!.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(sensible);
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
    routes: [],
  });
  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    keyGenerator: (req) => (req.headers['x-api-key'] as string) ?? req.ip,
  });
  await app.register(jwt, {
    secret: requiredEnv('JWT_SECRET'),
    sign: { iss: optionalEnv('JWT_ISSUER', 'fayapay.app') },
  });

  await app.register(authPlugin);
  await app.register(queuePlugin);

  app.get('/healthz', async () => ({ ok: true, ts: new Date().toISOString() }));
  app.get('/readyz', async () => ({ ok: true }));

  await registerRoutes(app);

  app.addHook('onRequest', (req, _reply, done) => {
    logger.debug({ reqId: req.id, method: req.method, url: req.url }, 'request');
    done();
  });

  return app;
}

const PORT = Number(optionalEnv('PORT', '4000'));
const HOST = optionalEnv('HOST', '0.0.0.0')!;

buildServer()
  .then((app) => app.listen({ port: PORT, host: HOST }))
  .then(() => logger.info({ port: PORT }, 'fayapay-api up'))
  .catch((err) => {
    if (err instanceof FayapayError) logger.fatal({ err }, 'fatal fayapay error');
    else logger.fatal({ err }, 'fatal');
    process.exit(1);
  });
