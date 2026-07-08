import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@fayapay/db';
import { ValidationError, InsufficientFundsError } from '@fayapay/shared';
import type { PostInput, ReverseInput } from './types.js';

/**
 * Post a balanced double-entry transaction.
 *
 * - Sum(debits) === Sum(credits) per currency, else ValidationError.
 * - All legs of same currency, else ValidationError.
 * - Transactionally checks WALLET sources for sufficient funds via SELECT FOR UPDATE.
 * - Returns the txGroupId. Idempotent on (referenceType, referenceId) when both are set.
 */
export async function post(input: PostInput): Promise<string> {
  validateLegs(input.legs);
  const txGroupId = input.txGroupId ?? randomUUID();

  return prisma.$transaction(async (tx) => {
    if (input.referenceType && input.referenceId) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { referenceType: input.referenceType, referenceId: input.referenceId },
        select: { txGroupId: true },
      });
      if (existing) return existing.txGroupId;
    }

    const debitAccounts = input.legs
      .filter((l) => l.direction === 'DEBIT')
      .map((l) => l.accountId);

    if (debitAccounts.length > 0) {
      const accts = await tx.account.findMany({
        where: { id: { in: debitAccounts } },
        select: { id: true, type: true, currency: true, availableBalance: true, status: true },
      });
      for (const leg of input.legs.filter((l) => l.direction === 'DEBIT')) {
        const acct = accts.find((a) => a.id === leg.accountId);
        if (!acct) throw new ValidationError(`Unknown account ${leg.accountId}`);
        if (acct.status !== 'ACTIVE') {
          throw new ValidationError(`Account ${leg.accountId} is ${acct.status}`);
        }
        if (acct.currency !== leg.currency) {
          throw new ValidationError(
            `Account ${leg.accountId} currency ${acct.currency} does not match leg ${leg.currency}`,
          );
        }
        if (acct.type === 'WALLET' || acct.type === 'CARD_FUNDING') {
          if (acct.availableBalance < leg.amount) {
            throw new InsufficientFundsError(
              leg.accountId,
              acct.availableBalance,
              leg.amount,
              leg.currency,
            );
          }
        }
      }
    }

    await tx.ledgerEntry.createMany({
      data: input.legs.map((l) => ({
        accountId: l.accountId,
        txGroupId,
        direction: l.direction,
        amount: l.amount,
        currency: l.currency,
        type: input.type,
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        metadata: (input.metadata ?? {}) as Prisma.JsonObject,
      })),
    });

    for (const leg of input.legs) {
      const delta = leg.direction === 'CREDIT' ? leg.amount : -leg.amount;
      await tx.account.update({
        where: { id: leg.accountId },
        data: { availableBalance: { increment: delta } },
      });
    }

    return txGroupId;
  });
}

/**
 * Reverse all entries in a tx group with opposite direction.
 * The new group has its own id and references the original.
 */
export async function reverse(input: ReverseInput): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.ledgerEntry.findMany({
      where: { txGroupId: input.txGroupId },
    });
    if (original.length === 0) {
      throw new ValidationError(`No ledger entries in group ${input.txGroupId}`);
    }
    const reversed = await post({
      type: original[0]!.type,
      description: `Reversal: ${input.reason}`,
      referenceType: input.referenceType ?? 'reversal',
      referenceId: input.referenceId ?? input.txGroupId,
      legs: original.map((e) => ({
        accountId: e.accountId,
        direction: e.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amount: e.amount,
        currency: e.currency,
      })),
    });
    return reversed;
  });
}

function validateLegs(legs: PostInput['legs']) {
  if (legs.length < 2) throw new ValidationError('Posting must have at least two legs');

  const byCurrency = new Map<string, { debit: bigint; credit: bigint }>();
  for (const l of legs) {
    if (l.amount <= 0n) throw new ValidationError('Leg amount must be positive');
    const bucket = byCurrency.get(l.currency) ?? { debit: 0n, credit: 0n };
    if (l.direction === 'DEBIT') bucket.debit += l.amount;
    else bucket.credit += l.amount;
    byCurrency.set(l.currency, bucket);
  }
  for (const [currency, { debit, credit }] of byCurrency) {
    if (debit !== credit) {
      throw new ValidationError(
        `Unbalanced posting for ${currency}: debit=${debit} credit=${credit}`,
      );
    }
  }
}
