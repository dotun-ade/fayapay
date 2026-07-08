import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError, ValidationError } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';
import { selectPayoutProvider } from '../services/payout-router.js';

const createSchema = z.object({
  accountId: z.string().uuid(),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n),
  currency: z.string().length(3),
  beneficiary: z.object({
    name: z.string().min(2),
    accountNumber: z.string().optional(),
    bankCode: z.string().optional(),
    iban: z.string().optional(),
    swift: z.string().optional(),
    sortCode: z.string().optional(),
    country: z.string().length(2).optional(),
  }),
  reference: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export const payoutsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/', async (req) => {
    const body = createSchema.parse(req.body);

    const existing = await prisma.payout.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (existing) return { ...existing, amount: existing.amount.toString() };

    const account = await prisma.account.findFirst({
      where: { id: body.accountId, businessId: req.businessId! },
    });
    if (!account) throw new NotFoundError('Account', body.accountId);
    if (account.currency !== body.currency) {
      throw new ValidationError(
        `Account currency ${account.currency} does not match payout currency ${body.currency}`,
      );
    }

    const provider = selectPayoutProvider({
      currency: body.currency,
      destinationCountry: body.beneficiary.country,
    });

    const payout = await prisma.payout.create({
      data: {
        accountId: account.id,
        provider,
        amount: body.amount,
        currency: body.currency,
        beneficiaryName: body.beneficiary.name,
        beneficiaryAccount: body.beneficiary.accountNumber ?? body.beneficiary.iban ?? '',
        beneficiaryBankCode: body.beneficiary.bankCode,
        beneficiaryIban: body.beneficiary.iban,
        beneficiarySwift: body.beneficiary.swift,
        reference: body.reference,
        status: 'PENDING',
        idempotencyKey: body.idempotencyKey,
        metadata: { sortCode: body.beneficiary.sortCode ?? null, country: body.beneficiary.country ?? null },
      },
    });

    await app.queues.payouts.add(
      'submit-payout',
      { payoutId: payout.id },
      { jobId: `payout:${payout.id}` },
    );

    return { ...payout, amount: payout.amount.toString() };
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!payout || payout.account.businessId !== req.businessId) {
      throw new NotFoundError('Payout', id);
    }
    return { ...payout, amount: payout.amount.toString() };
  });
};
