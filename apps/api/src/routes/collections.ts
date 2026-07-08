import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError, ValidationError } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';
import { PaystackClient } from '@fayapay/paystack';
import { FlutterwaveClient } from '@fayapay/flutterwave';

const createDvaSchema = z.object({
  accountId: z.string().uuid(),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    bvn: z.string().length(11).optional(),
  }),
  preferredBank: z.enum(['wema-bank', 'titan-paystack', 'flutterwave']).optional(),
});

const initChargeSchema = z.object({
  accountId: z.string().uuid(),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n),
  currency: z.enum(['NGN', 'KES', 'GHS', 'USD']),
  customerEmail: z.string().email(),
  callbackUrl: z.string().url(),
  channels: z.array(z.enum(['card', 'bank', 'ussd', 'bank_transfer', 'mobile_money'])).optional(),
});

export const collectionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/dva', async (req) => {
    const body = createDvaSchema.parse(req.body);
    const account = await prisma.account.findFirst({
      where: { id: body.accountId, businessId: req.businessId! },
    });
    if (!account) throw new NotFoundError('Account', body.accountId);
    if (account.currency !== 'NGN') throw new ValidationError('DVA only supported for NGN accounts');

    if (body.preferredBank === 'flutterwave') {
      const flw = new FlutterwaveClient();
      const va = await flw.createVirtualAccount({
        email: body.customer.email,
        is_permanent: true,
        bvn: body.customer.bvn,
        tx_ref: `dva-${account.id}`,
        firstname: body.customer.firstName,
        lastname: body.customer.lastName,
        narration: `${body.customer.firstName} ${body.customer.lastName}`.slice(0, 20),
      });
      return {
        provider: 'flutterwave',
        accountNumber: va.account_number,
        bankName: va.bank_name,
        orderRef: va.order_ref,
      };
    }

    const psk = new PaystackClient();
    const customer = await psk.createCustomer({
      email: body.customer.email,
      first_name: body.customer.firstName,
      last_name: body.customer.lastName,
      phone: body.customer.phone,
    });
    const dva = await psk.createDedicatedAccount({
      customer: customer.customer_code,
      preferred_bank: (body.preferredBank as 'wema-bank' | 'titan-paystack' | undefined) ?? 'wema-bank',
    });
    return {
      provider: 'paystack',
      accountNumber: dva.account_number,
      bankName: dva.bank.name,
      accountName: dva.account_name,
    };
  });

  app.post('/charge', async (req) => {
    const body = initChargeSchema.parse(req.body);
    const account = await prisma.account.findFirst({
      where: { id: body.accountId, businessId: req.businessId! },
    });
    if (!account) throw new NotFoundError('Account', body.accountId);

    // Route by currency for now — NG uses Paystack, others use Flutterwave.
    if (account.currency === 'NGN' && body.currency === 'NGN') {
      const psk = new PaystackClient();
      const ref = `chg_${crypto.randomUUID().replace(/-/g, '')}`;
      const init = await psk.initializeTransaction({
        email: body.customerEmail,
        amount: Number(body.amount), // kobo
        callback_url: body.callbackUrl,
        reference: ref,
        channels: body.channels,
        metadata: { accountId: account.id, businessId: req.businessId! },
      });
      await prisma.collection.create({
        data: {
          accountId: account.id,
          provider: 'PAYSTACK',
          providerRef: ref,
          amount: body.amount,
          currency: body.currency,
          payerEmail: body.customerEmail,
          method: 'card',
          status: 'PENDING',
        },
      });
      return { provider: 'paystack', authorizationUrl: init.authorization_url, reference: ref };
    }
    const flw = new FlutterwaveClient();
    const ref = `chg_${crypto.randomUUID().replace(/-/g, '')}`;
    const init = await flw.createBankTransferCharge({
      tx_ref: ref,
      amount: Number(body.amount) / 100,
      currency: 'NGN',
      email: body.customerEmail,
    });
    await prisma.collection.create({
      data: {
        accountId: account.id,
        provider: 'FLUTTERWAVE',
        providerRef: ref,
        amount: body.amount,
        currency: body.currency,
        payerEmail: body.customerEmail,
        method: 'bank_transfer',
        status: 'PENDING',
      },
    });
    return { provider: 'flutterwave', transferAccount: init.transfer_account, transferBank: init.transfer_bank, reference: ref };
  });

  app.get('/', async (req) => {
    const where = { account: { businessId: req.businessId! } };
    const data = await prisma.collection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { data: data.map((c) => ({ ...c, amount: c.amount.toString() })) };
  });
};
