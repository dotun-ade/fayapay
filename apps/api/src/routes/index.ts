import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { cardholderRoutes } from './cardholders.js';
import { cardsRoutes } from './cards.js';
import { accountsRoutes } from './accounts.js';
import { transfersRoutes } from './transfers.js';
import { payoutsRoutes } from './payouts.js';
import { collectionsRoutes } from './collections.js';
import { fxRoutes } from './fx.js';
import { kycRoutes } from './kyc.js';
import { webhookRoutes } from './webhooks/index.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(cardholderRoutes, { prefix: '/v1/cardholders' });
  await app.register(cardsRoutes, { prefix: '/v1/cards' });
  await app.register(accountsRoutes, { prefix: '/v1/accounts' });
  await app.register(transfersRoutes, { prefix: '/v1/transfers' });
  await app.register(payoutsRoutes, { prefix: '/v1/payouts' });
  await app.register(collectionsRoutes, { prefix: '/v1/collections' });
  await app.register(fxRoutes, { prefix: '/v1/fx' });
  await app.register(kycRoutes, { prefix: '/v1/kyc' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
}
