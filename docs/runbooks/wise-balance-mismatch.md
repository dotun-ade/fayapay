# Runbook: Wise balance does not match our ledger

## Symptoms

- Recon report flags Wise SETTLEMENT account drift > 1 USD
- Alert: `wise-balance-mismatch` (PagerDuty)

## Diagnose

```bash
# Our settlement balance
psql -c "select currency, available_balance from accounts
         where external_provider='wise' and type='SETTLEMENT';"

# Wise actual balance
curl -H "Authorization: Bearer $WISE_API_TOKEN" \
  https://api.transferwise.com/v4/profiles/$WISE_PROFILE_ID/balances?types=STANDARD
```

Diff. Note Wise returns major units (USD), our ledger is in minor units (cents). The recon worker handles that conversion; manual checks need to scale.

## Common causes

1. **Wise fee adjustment after settlement.** Wise occasionally adjusts the fee on a completed transfer 1–2 days later. We don't book this; treat as a fee variance.
2. **Webhook missed.** Re-run the resync job for the affected transfers.
3. **Cancelled transfer that we already debited.** Reverse the ledger entry — `pnpm tsx scripts/ledger/reverse-tx.ts <txGroupId>`.

## Don't

Don't manually credit/debit the SETTLEMENT account "to make it match". That hides the real problem and the next recon will flag again. Always trace to a specific transfer or charge.
