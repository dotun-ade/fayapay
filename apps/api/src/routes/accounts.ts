import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError } from '@fayapay/shared';
import { balanceFromEntries } from '@fayapay/ledger';
import type { FastifyPluginAsync } from 'fastify';

const createSchema = z.object({
  cardholderId: z.string().uuid().optional(),
  type: z.enum(['WALLET', 'COLLECTION', 'SETTLEMENT', 'CARD_FUNDING', 'FX_BUFFER', 'FEE']),
  currency: z.enum(['NGN', 'KES', 'GHS', 'ZAR', 'USD', 'EUR', 'GBP']),
});

export const accountsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/', async (req) => {
    const body = createSchema.parse(req.body);
    return prisma.account.create({
      data: { businessId: req.businessId!, ...body },
    });
  });

  app.get('/', async (req) => {
    return prisma.account.findMany({
      where: { businessId: req.businessId! },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const account = await prisma.account.findFirst({
      where: { id, businessId: req.businessId! },
    });
    if (!account) throw new NotFoundError('Account', id);
    return {
      ...account,
      // Strings for safety — JSON can't carry BigInt natively.
      availableBalance: account.availableBalance.toString(),
      pendingBalance: account.pendingBalance.toString(),
      reservedBalance: account.reservedBalance.toString(),
    };
  });

  app.get('/:id/balance', async (req) => {
    const { id } = req.params as { id: string };
    const account = await prisma.account.findFirst({
      where: { id, businessId: req.businessId! },
    });
    if (!account) throw new NotFoundError('Account', id);
    const truth = await balanceFromEntries(id);
    return {
      currency: account.currency,
      available: account.availableBalance.toString(),
      ledger: truth.toString(),
      drift: (account.availableBalance - truth).toString(),
    };
  });

  app.get('/:id/entries', async (req) => {
    const { id } = req.params as { id: string };
    const account = await prisma.account.findFirst({
      where: { id, businessId: req.businessId! },
    });
    if (!account) throw new NotFoundError('Account', id);
    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId: id },
      orderBy: { postedAt: 'desc' },
      take: 200,
    });
    return {
      data: entries.map((e) => ({ ...e, amount: e.amount.toString() })),
    };
  });
};
