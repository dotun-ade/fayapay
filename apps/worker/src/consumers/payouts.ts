import { prisma } from '@fayapay/db';
import { logger, ProviderError } from '@fayapay/shared';
import { PaystackClient } from '@fayapay/paystack';
import { FlutterwaveClient } from '@fayapay/flutterwave';
import { WiseClient } from '@fayapay/wise';
import { ModulrClient } from '@fayapay/modulr';
import { CurrencycloudClient } from '@fayapay/currencycloud';
import { post as ledgerPost } from '@fayapay/ledger';
import type { Job } from 'bullmq';

/**
 * Pull a payout, submit to the provider, write the ledger pending entries,
 * update local row. The provider's terminal webhook flips status to COMPLETED
 * (or FAILED). We pre-debit the source on submission and reverse on FAILED.
 */
export async function processPayout(job: Job<{ payoutId: string }>) {
  const payout = await prisma.payout.findUnique({
    where: { id: job.data.payoutId },
    include: { account: true },
  });
  if (!payout) return;
  if (payout.status !== 'PENDING') {
    logger.info({ payoutId: payout.id, status: payout.status }, 'payout already moved');
    return;
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  try {
    let providerRef: string | undefined;
    switch (payout.provider) {
      case 'PAYSTACK': {
        const ps = new PaystackClient();
        const recipient = await ps.createTransferRecipient({
          type: 'nuban',
          name: payout.beneficiaryName,
          account_number: payout.beneficiaryAccount,
          bank_code: payout.beneficiaryBankCode!,
          currency: 'NGN',
        });
        const t = await ps.initiateTransfer({
          source: 'balance',
          amount: Number(payout.amount), // kobo
          recipient: recipient.recipient_code,
          reason: payout.reference ?? 'Fayapay payout',
          reference: payout.idempotencyKey,
        });
        providerRef = t.transfer_code;
        break;
      }
      case 'FLUTTERWAVE': {
        const fw = new FlutterwaveClient();
        const t = await fw.createTransfer({
          account_bank: payout.beneficiaryBankCode!,
          account_number: payout.beneficiaryAccount,
          amount: Number(payout.amount) / 100,
          currency: payout.currency,
          reference: payout.idempotencyKey,
          beneficiary_name: payout.beneficiaryName,
          narration: payout.reference ?? undefined,
        });
        providerRef = String(t.id);
        break;
      }
      case 'WISE': {
        const w = new WiseClient();
        const quote = await w.createQuote({
          sourceCurrency: payout.currency,
          targetCurrency: payout.currency,
          sourceAmount: Number(payout.amount) / 100,
          payOut: 'BANK_TRANSFER',
        });
        const recipient = await w.createRecipient({
          accountHolderName: payout.beneficiaryName,
          currency: payout.currency,
          type: payout.beneficiaryIban ? 'iban' : 'aba',
          details: payout.beneficiaryIban
            ? { iban: payout.beneficiaryIban, BIC: payout.beneficiarySwift }
            : { accountNumber: payout.beneficiaryAccount, abartn: payout.beneficiaryBankCode },
        });
        const t = await w.createTransfer({
          targetAccount: recipient.id,
          quoteUuid: quote.id,
          customerTransactionId: payout.idempotencyKey,
          details: { reference: payout.reference ?? 'Fayapay' },
        });
        await w.fundTransfer(t.id);
        providerRef = String(t.id);
        break;
      }
      case 'MODULR': {
        const m = new ModulrClient();
        const t = await m.createPayment({
          sourceAccountId: payout.account.externalRef ?? '',
          destination: {
            type: 'SCAN',
            accountNumber: payout.beneficiaryAccount,
            sortCode: (payout.metadata as Record<string, string>)?.['sortCode'] ?? '',
            name: payout.beneficiaryName,
          },
          amount: Number(payout.amount) / 100,
          currency: 'GBP',
          reference: payout.reference ?? 'Fayapay',
          externalReference: payout.idempotencyKey,
        });
        providerRef = t.id;
        break;
      }
      case 'CURRENCYCLOUD': {
        const cc = new CurrencycloudClient();
        const ben = await cc.createBeneficiary({
          bank_country: 'GB',
          currency: payout.currency,
          iban: payout.beneficiaryIban,
          bic_swift: payout.beneficiarySwift,
          bank_account_holder_name: payout.beneficiaryName,
          name: payout.beneficiaryName,
        });
        const t = await cc.createPayment({
          currency: payout.currency,
          beneficiary_id: ben.id,
          amount: (Number(payout.amount) / 100).toFixed(2),
          reason: payout.reference ?? 'Fayapay',
          reference: payout.idempotencyKey,
        });
        providerRef = t.id;
        break;
      }
    }

    // Pre-debit ledger (source account → external settlement)
    const settlement = await ensureSettlementAccount(
      payout.account.businessId,
      payout.currency,
      payout.provider.toLowerCase(),
    );
    await ledgerPost({
      type: 'PAYOUT',
      description: `Payout ${payout.id} via ${payout.provider}`,
      referenceType: 'payout',
      referenceId: payout.id,
      legs: [
        {
          accountId: payout.accountId,
          direction: 'DEBIT',
          amount: payout.amount,
          currency: payout.currency,
        },
        {
          accountId: settlement.id,
          direction: 'CREDIT',
          amount: payout.amount,
          currency: payout.currency,
        },
      ],
    });

    await prisma.payout.update({
      where: { id: payout.id },
      data: { providerPayoutId: providerRef },
    });
  } catch (err) {
    const reason =
      err instanceof ProviderError ? err.message : (err as Error).message ?? 'unknown';
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'FAILED', failureReason: reason },
    });
    if (err instanceof ProviderError && err.retryable && payout.attempts < 5) {
      throw err; // BullMQ will retry per defaultJobOptions.backoff
    }
  }
}

async function ensureSettlementAccount(businessId: string, currency: string, provider: string) {
  const existing = await prisma.account.findFirst({
    where: { businessId, currency, type: 'SETTLEMENT', externalProvider: provider },
  });
  if (existing) return existing;
  return prisma.account.create({
    data: { businessId, type: 'SETTLEMENT', currency, externalProvider: provider },
  });
}
