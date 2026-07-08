import { prisma } from '@fayapay/db';

/**
 * Authoritative balance — recomputed from ledger entries. Slow.
 * Use `Account.availableBalance` for hot reads, this for recon.
 */
export async function balanceFromEntries(accountId: string): Promise<bigint> {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ['direction'],
    where: { accountId },
    _sum: { amount: true },
  });
  let credit = 0n;
  let debit = 0n;
  for (const r of rows) {
    if (r.direction === 'CREDIT') credit = r._sum.amount ?? 0n;
    if (r.direction === 'DEBIT') debit = r._sum.amount ?? 0n;
  }
  return credit - debit;
}

export async function balanceAt(accountId: string, asOf: Date): Promise<bigint> {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ['direction'],
    where: { accountId, postedAt: { lte: asOf } },
    _sum: { amount: true },
  });
  let credit = 0n;
  let debit = 0n;
  for (const r of rows) {
    if (r.direction === 'CREDIT') credit = r._sum.amount ?? 0n;
    if (r.direction === 'DEBIT') debit = r._sum.amount ?? 0n;
  }
  return credit - debit;
}

/**
 * Recon: walk every account and compare denorm vs ledger sum.
 * Returns drift rows. The recon worker calls this hourly.
 */
export async function reconcileAllAccounts(): Promise<
  Array<{ accountId: string; denorm: bigint; truth: bigint; drift: bigint }>
> {
  const accounts = await prisma.account.findMany({
    select: { id: true, availableBalance: true },
  });
  const out: Array<{ accountId: string; denorm: bigint; truth: bigint; drift: bigint }> = [];
  for (const acct of accounts) {
    const truth = await balanceFromEntries(acct.id);
    if (truth !== acct.availableBalance) {
      out.push({
        accountId: acct.id,
        denorm: acct.availableBalance,
        truth,
        drift: acct.availableBalance - truth,
      });
    }
  }
  return out;
}
