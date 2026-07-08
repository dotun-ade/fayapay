# Runbook: Paystack settlement lag

## Symptoms

- Dashboard → Accounts → settlement (provider=`paystack`) shows growing positive balance
- Recon worker reports drift > 1,000,000 NGN
- Customers calling about pending balance > 30 min

## Why this happens

Paystack settles to our bank T+1 (or T+2 for cards on certain banks). The drift between our ledger COLLECTION account and the SETTLEMENT account is *normal* within the settlement window.

It becomes a problem when:
- Settlement window is exceeded (> 36h)
- Paystack is itself behind on settlement
- Our DVA → wallet ledger entry didn't post because the webhook was missed

## Diagnose

```bash
# Pending balance on Paystack
curl -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
  https://api.paystack.co/balance

# Our internal settlement queue
psql -c "select sum(amount)::text, currency from accounts
         where external_provider='paystack' and type='SETTLEMENT'
         group by currency;"

# Missed webhooks (last 24h, paystack, processed_at null)
psql -c "select event_type, count(*) from webhook_events
         where provider='paystack' and processed_at is null
         and received_at > now() - interval '24h'
         group by 1;"
```

## Mitigate

If missed webhooks → replay them:

```bash
# Re-enqueue the queue worker job for each row
psql -c "select id from webhook_events
         where provider='paystack' and processed_at is null;" \
| xargs -I{} curl -X POST \
  -H "Authorization: Bearer $INTERNAL_API_KEY" \
  http://localhost:4000/internal/webhooks/{}/replay
```

If Paystack itself is lagging — contact `#vendor-escalations`, mention the affected merchant code. Do NOT manually post a `COLLECTION` ledger entry without a confirmed Paystack-side reference.
