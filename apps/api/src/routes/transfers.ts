import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError, ValidationError, ConflictError } from '@fayapay/shared';
import { post as ledgerPost } from '@fayapay/ledger';
import type { FastifyPluginAsync } from 'fastify';

const createSchema = z.object({
  sourceAccountId: z.string().uuid(),
  destAccountId: z.string().uuid(),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n, 'amount must be positive'),
  currency: z.string().length(3),
  reference: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export const transfersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/', async (req) => {
    const body = createSchema.parse(req.body);

    const existing = await prisma.transfer.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (existing) return { ...existing, amount: existing.amount.toString() };

    const [src, dst] = await Promise.all([
      prisma.account.findFirst({
        where: { id: body.sourceAccountId, businessId: req.businessId! },
      }),
      prisma.account.findFirst({
        where: { id: body.destAccountId, businessId: req.businessId! },
      }),
    ]);
    if (!src) throw new NotFoundError('Source account', body.sourceAccountId);
    if (!dst) throw new NotFoundError('Destination account', body.destAccountId);
    if (src.currency !== body.currency || dst.currency !== body.currency) {
      throw new ValidationError('Currency mismatch — use /v1/fx for cross-currency transfers');
    }
    if (src.id === dst.id) throw new ConflictError('Source and destination cannot be the same');

    const transfer = await prisma.transfer.create({
      data: {
        businessId: req.businessId!,
        sourceAccountId: body.sourceAccountId,
        destAccountId: body.destAccountId,
        amount: body.amount,
        currency: body.currency,
        reference: body.reference,
        idempotencyKey: body.idempotencyKey,
        status: 'PENDING',
      },
    });

    try {
      await ledgerPost({
        type: 'TRANSFER',
        description: body.reference ?? 'Internal transfer',
        referenceType: 'transfer',
        referenceId: transfer.id,
        legs: [
          { accountId: src.id, direction: 'DEBIT', amount: body.amount, currency: body.currency },
          { accountId: dst.id, direction: 'CREDIT', amount: body.amount, currency: body.currency },
        ],
      });
      const completed = await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return { ...completed, amount: completed.amount.toString() };
    } catch (err) {
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: 'FAILED', failureReason: (err as Error).message },
      });
      throw err;
    }
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const transfer = await prisma.transfer.findFirst({
      where: { id, businessId: req.businessId! },
    });
    if (!transfer) throw new NotFoundError('Transfer', id);
    return { ...transfer, amount: transfer.amount.toString() };
  });

  app.get('/', async (req) => {
    const data = await prisma.transfer.findMany({
      where: { businessId: req.businessId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { data: data.map((t) => ({ ...t, amount: t.amount.toString() })) };
  });
};
