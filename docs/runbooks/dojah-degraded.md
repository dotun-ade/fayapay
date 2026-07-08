# Runbook: Dojah degraded

Dojah is our sole identity vendor. There is no automated failover.

## Symptoms

- KYC queue (`/kyc`) backlog grows
- `kyc_records.status = PENDING` or `IN_REVIEW` count climbs
- Dojah webhook events not arriving, or 5xx rate climbing on `/api/v1/kyc/bvn/full`
- Alert: `dojah-degraded` (PagerDuty)

## Diagnose

```bash
# Dojah call error rate, last 30 min
psql -c "
  select coalesce(last_error, 'ok') as outcome, count(*)
  from kyc_records
  where provider='dojah' and updated_at > now() - interval '30 min'
  group by 1 order by 2 desc;
"

# Webhook delivery in the last 30 min
psql -c "
  select event_type, signature_valid, count(*)
  from webhook_events
  where provider='dojah' and received_at > now() - interval '30 min'
  group by 1, 2;
"

# Check Dojah status
open https://status.dojah.io/
```

If error rate > 5% sustained for 10 min, treat as degraded.

## Mitigate

There is no second vendor. Options, in order of preference:

1. **Wait it out.** Dojah's mean outage in the past 12 months is 28 min. The queue can hold.
2. **Pause card issuance** for new cardholders if backlog crosses 1h.

   ```bash
   doppler secrets set FEATURE_SUDO_PRIMARY_NG=false --config prd
   fly deploy -a fayapay-api
   ```

   This rejects new card creation requests with a clear error message. Existing cards keep working — card auths don't depend on KYC.

3. **Work the backlog manually.** Compliance ops can mark records APPROVED via `/v1/admin/kyc/approve` after a manual review against the source ID document, but **only** for tier-1 customers (issuance ≤ NGN 500k/month).

## Resume

After Dojah is green for 15 min:

```bash
# Re-enable card issuance
doppler secrets set FEATURE_SUDO_PRIMARY_NG=true --config prd

# Replay queued records
pnpm tsx scripts/dojah-replay-backlog.ts --since '30 minutes ago'
```

## Post-incident

- Open a Linear ticket per cardholder that was manually approved during the outage.
- If outage > 1h, schedule a follow-up on the second-vendor RFP.
