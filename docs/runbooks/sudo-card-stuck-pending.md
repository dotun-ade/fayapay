# Runbook: Sudo card stuck in PENDING

## Symptoms

- Card created via `POST /v1/cards` (provider=`SUDO`) still shows `status=PENDING`
- No `last4` or expiry on the card row
- Older than 5 minutes
- Customer support ticket

## Why this happens

Sudo's `POST /cards` is asynchronous. We get an immediate response with `_id` but no card details. The `card.created` webhook fills in `maskedPan`, `expiryMonth`, `expiryYear`, and flips `status` to `active`. This usually takes 30s–4min.

If the webhook is delayed beyond 5min the issue is usually one of:
1. Sudo issuance backlog (check status page)
2. Webhook endpoint URL changed and the dashboard is still pointing at the old one
3. Funding source mis-configured (Sudo silently parks the card pending settlement)

## Diagnose

```bash
# Get the provider-side state directly
curl -H "Authorization: Bearer $SUDO_API_KEY" \
  https://api.sudo.cards/cards/<provider_card_id> | jq .

# Look for the webhook delivery (or its absence)
psql -c "select event_type, received_at, processed_at from webhook_events
         where provider='sudo' and payload->'data'->'object'->>'_id' = '<provider_card_id>';"
```

## Mitigate

If Sudo says the card is `active` but we never saw the webhook, run the resync job:

```bash
pnpm tsx scripts/sudo-resync-card.ts <card_id>
```

That fetches the card via the Sudo client and updates our row in one transaction.

If Sudo also says `pending` beyond 30 min — `#vendor-escalations` Sudo support.
