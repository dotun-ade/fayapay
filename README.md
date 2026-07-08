# Fayapay

Fayapay is a card-issuing fintech. We let businesses issue NGN, KES, and GHS cards to their users — virtual and physical — and move money between Africa and USD/EUR/GBP rails.

This is the platform monorepo. Customer-facing apps (iOS, Android, the embed SDK) live in separate repos.

## What's in here

```
apps/
  api/          Fastify HTTP API. The thing customers hit.
  web/          Next.js admin dashboard. Internal ops + customer self-serve.
  worker/       BullMQ background workers. Webhooks, payouts, KYC polling.
packages/
  db/           Prisma schema + client + migrations + seed.
  ledger/       Double-entry ledger. Source of truth for balances.
  shared/       Errors, HMAC verifiers, idempotency, logger, money type.
  integrations/
    sudo/             Sudo Africa  — NGN/KES/GHS card issuer
    paystack/         Paystack     — NGN collections + transfers
    flutterwave/      Flutterwave  — pan-Africa collections + payouts
    wise/             Wise         — multi-currency send + FX
    currencycloud/    Currencycloud— GBP/EUR collection accounts + FX
    modulr/           Modulr       — GBP Faster Payments
    dojah/            Dojah        — KYC (BVN/NIN/CAC)
docs/
  adr/          Architecture decisions. Read these before changing provider routing.
  runbooks/     On-call. One per integration.
  onboarding/   Day-0 setup for new engineers.
```

## Quickstart

You need Node 20+, pnpm 9, Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up        # Postgres, Redis, Mailhog
pnpm db:migrate
pnpm db:seed
pnpm dev             # api + web + worker, in parallel
```

API on `:4000`, dashboard on `:3000`, Mailhog on `:8025`.

## Provider routing (short version)

Read [docs/adr/0003-provider-routing.md](docs/adr/0003-provider-routing.md) for the long version. The short version:

| Currency | Card issuer        | Collections / Payouts              |
| -------- | ------------------ | ---------------------------------- |
| NGN      | Sudo Africa        | Paystack (primary), Flutterwave    |
| KES      | Sudo Africa        | Flutterwave                        |
| GHS      | Sudo Africa        | Flutterwave, Paystack              |
| ZAR      | (no issuer)        | Flutterwave                        |
| USD      | (no issuer)        | Wise                               |
| EUR      | (no issuer)        | Wise, Currencycloud                |
| GBP      | (no issuer)        | Modulr (Faster Payments), Wise     |

USD/EUR/GBP card issuance is on the roadmap; for now only the rails are wired.

KYC is Dojah. We use Dojah for BVN, NIN, and CAC. Other id types route to manual review.

## Things to know before changing anything

- **The ledger is the source of truth for balances.** Provider balances drift; ours doesn't. If they disagree, ours is right and we open a recon ticket. See [packages/ledger/README.md](packages/ledger/README.md).
- **Webhook handlers are idempotent.** Always. We dedupe on `(provider, provider_event_id)`. See `packages/shared/src/idempotency.ts`.
- **Provider clients never write to the DB.** They return raw payloads; the calling service decides what to persist.
- **No live secrets in this repo. Ever.** Doppler in staging/prod. `.env` is local-only and gitignored.

## Where things go wrong

- Sudo's `/cards` POST is async — the card object you get back is `pending`. The actual PAN comes via the `card.created` webhook 30s–4min later. The worker handles this; do not block API responses on it.
- Wise webhook signatures use detached RSA over the raw body. If you re-serialize the body before verifying, you'll fail. There's a `rawBody` plugin on the API for exactly this reason.
- Flutterwave's `secret_hash` is a header value you compare verbatim — it's not an HMAC. People keep getting this wrong.
- Dojah is our only identity vendor — no failover. If Dojah is degraded, new KYC submissions queue and we work the backlog manually. See [docs/runbooks/dojah-degraded.md](docs/runbooks/dojah-degraded.md).

## Contacts

- On-call rotation: PagerDuty service `fayapay-platform`
- Infra channel: `#eng-platform`
- Vendor escalations: `#vendor-escalations` (tag `@payments-oncall`)
