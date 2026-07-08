import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError, ValidationError, ConflictError } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';
import { issueCard } from '../services/card-router.js';

const createSchema = z.object({
  cardholderId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  type: z.enum(['VIRTUAL', 'PHYSICAL']).default('VIRTUAL'),
  brand: z.enum(['VISA', 'MASTERCARD', 'VERVE']).default('VISA'),
  currency: z.enum(['NGN', 'KES', 'GHS']),
  nameOnCard: z.string().min(2),
  shippingAddress: z
    .object({
      line1: z.string(),
      city: z.string(),
      region: z.string(),
      postalCode: z.string(),
      country: z.string().length(2),
    })
    .optional(),
  spendingControls: z
    .object({
      monthlyLimit: z.number().int().positive().optional(),
      transactionLimit: z.number().int().positive().optional(),
      allowedMccs: z.array(z.string()).optional(),
      blockedMccs: z.array(z.string()).optional(),
      allowedCountries: z.array(z.string()).optional(),
    })
    .optional(),
});

export const cardsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/', async (req) => {
    const body = createSchema.parse(req.body);
    const cardholder = await prisma.cardholder.findFirst({
      where: { id: body.cardholderId, businessId: req.businessId! },
    });
    if (!cardholder) throw new NotFoundError('Cardholder', body.cardholderId);
    if (cardholder.kycStatus !== 'APPROVED') {
      throw new ValidationError('Cardholder KYC must be APPROVED before issuing cards', {
        kycStatus: cardholder.kycStatus,
      });
    }
    if (body.type === 'PHYSICAL' && !body.shippingAddress) {
      throw new ValidationError('shippingAddress required for physical cards');
    }

    const card = await issueCard({
      businessId: req.businessId!,
      cardholder,
      input: body,
      cardEventsQueue: app.queues.cardEvents,
    });
    return card;
  });

  app.get('/', async (req) => {
    const { cardholderId, status, page = '1', limit = '50' } = (req.query ?? {}) as Record<
      string,
      string
    >;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const where = {
      businessId: req.businessId!,
      ...(cardholderId ? { cardholderId } : {}),
      ...(status ? { status: status as 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CANCELLED' } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.card.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.card.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: take };
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const card = await prisma.card.findFirst({
      where: { id, businessId: req.businessId! },
      include: { cardholder: true, account: true },
    });
    if (!card) throw new NotFoundError('Card', id);
    return card;
  });

  app.post('/:id/freeze', async (req) => {
    const { id } = req.params as { id: string };
    const card = await prisma.card.findFirst({ where: { id, businessId: req.businessId! } });
    if (!card) throw new NotFoundError('Card', id);
    if (card.status === 'CANCELLED') throw new ConflictError('Card is cancelled');
    await app.queues.cardEvents.add('freeze', { cardId: id });
    return prisma.card.update({ where: { id }, data: { status: 'FROZEN', frozenAt: new Date() } });
  });

  app.post('/:id/unfreeze', async (req) => {
    const { id } = req.params as { id: string };
    const card = await prisma.card.findFirst({ where: { id, businessId: req.businessId! } });
    if (!card) throw new NotFoundError('Card', id);
    await app.queues.cardEvents.add('unfreeze', { cardId: id });
    return prisma.card.update({ where: { id }, data: { status: 'ACTIVE', frozenAt: null } });
  });

  app.post('/:id/cancel', async (req) => {
    const { id } = req.params as { id: string };
    const card = await prisma.card.findFirst({ where: { id, businessId: req.businessId! } });
    if (!card) throw new NotFoundError('Card', id);
    await app.queues.cardEvents.add('cancel', { cardId: id });
    return prisma.card.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  });

  app.get('/:id/transactions', async (req) => {
    const { id } = req.params as { id: string };
    const card = await prisma.card.findFirst({ where: { id, businessId: req.businessId! } });
    if (!card) throw new NotFoundError('Card', id);
    const data = await prisma.cardTransaction.findMany({
      where: { cardId: id },
      orderBy: { postedAt: 'desc' },
      take: 100,
    });
    return { data };
  });
};
