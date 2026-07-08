# Runbook: Reconciliation

We run recon hourly via the `recon` queue (see `apps/worker/src/consumers/recon.ts`).

The job calls `reconcileAllAccounts()` from `@fayapay/ledger` and reports drift between:
- `accounts.available_balance` (denorm, trigger-maintained)
- Sum of `ledger_entries` (truth)

These should always agree. If they don't, the denorm is wrong — never the ledger.

## When the denorm is drifted

```bash
# Rebuild denorm from ledger (production-safe, takes ~1m per 1M entries)
psql -c "
WITH truth AS (
  SELECT account_id,
         COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN direction='DEBIT'  THEN amount ELSE 0 END), 0) AS bal
  FROM ledger_entries
  GROUP BY 1
)
UPDATE accounts a SET available_balance = COALESCE(t.bal, 0)
FROM truth t WHERE t.account_id = a.id;
"
```

## When provider balance disagrees with ours

That's a different problem — handled per-provider:
- [paystack-settlement-lag.md](paystack-settlement-lag.md)
- [wise-balance-mismatch.md](wise-balance-mismatch.md)

## Escalation thresholds

See [ADR-0011](../adr/0011-recon-thresholds.md).
