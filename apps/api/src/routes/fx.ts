import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { ValidationError, optionalEnv } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';
import { WiseClient } from '@fayapay/wise';
import { CurrencycloudClient } from '@fayapay/currencycloud';

const quoteSchema = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
  fromAmount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(v))
    .optional(),
  toAmount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(v))
    .optional(),
});

export const fxRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/quote', async (req) => {
    const body = quoteSchema.parse(req.body);
    if (!body.fromAmount && !body.toAmount) {
      throw new ValidationError('Provide either fromAmount or toAmount');
    }

    const provider = optionalEnv('FEATURE_FX_PROVIDER', 'wise');

    if (provider === 'currencycloud') {
      const cc = new CurrencycloudClient();
      const conv = await cc.createConversion({
        buy_currency: body.to,
        sell_currency: body.from,
        fixed_side: body.fromAmount ? 'sell' : 'buy',
        amount: (Number((body.fromAmount ?? body.toAmount ?? 0n)) / 100).toFixed(2),
        term_agreement: true,
      });
      return persistQuote({
        provider: 'currencycloud',
        pair: `${body.from}${body.to}`,
        rate: Number(conv.client_rate),
        fromAmount: BigInt(Math.round(Number(conv.client_sell_amount) * 100)),
        toAmount: BigInt(Math.round(Number(conv.client_buy_amount) * 100)),
        providerQuoteId: conv.id,
      });
    }

    const wise = new WiseClient();
    const q = await wise.createQuote({
      sourceCurrency: body.from,
      targetCurrency: body.to,
      sourceAmount: body.fromAmount ? Number(body.fromAmount) / 100 : undefined,
      targetAmount: body.toAmount ? Number(body.toAmount) / 100 : undefined,
    });
    return persistQuote({
      provider: 'wise',
      pair: `${body.from}${body.to}`,
      rate: q.rate,
      fromAmount: BigInt(Math.round((q.sourceAmount ?? 0) * 100)),
      toAmount: BigInt(Math.round((q.targetAmount ?? 0) * 100)),
      providerQuoteId: q.id,
    });
  });
};

async function persistQuote(input: {
  provider: string;
  pair: string;
  rate: number;
  fromAmount: bigint;
  toAmount: bigint;
  providerQuoteId: string;
}) {
  const quote = await prisma.fxQuote.create({
    data: {
      provider: input.provider,
      pair: input.pair,
      side: 'BUY',
      rate: input.rate,
      fromAmount: input.fromAmount,
      toAmount: input.toAmount,
      spreadBps: 25,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      providerQuoteId: input.providerQuoteId,
    },
  });
  return {
    id: quote.id,
    provider: quote.provider,
    pair: quote.pair,
    rate: quote.rate.toString(),
    fromAmount: quote.fromAmount.toString(),
    toAmount: quote.toAmount.toString(),
    expiresAt: quote.expiresAt,
  };
}
