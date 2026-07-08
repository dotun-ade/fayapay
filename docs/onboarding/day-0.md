# Day 0: getting set up

Welcome. Read this from top to bottom before you touch the codebase.

## Accounts you need

Ask your manager to ping `#it-onboarding` for:

- Doppler — staging + prod secrets
- AWS — `fayapay-staging` and `fayapay-prod` SSO roles
- Linear — projects: `Platform`, `Compliance`, `Recon`, `Incidents`
- PagerDuty — read access; on-call adds you later
- Provider dashboards (read-only): Sudo, Paystack, Flutterwave, Wise, Currencycloud, Modulr, Dojah. The shared password vault is in 1Password under `Vendor Dashboards`.

## Local setup

```bash
git clone git@github.com:fayapay/platform.git
cd platform
nvm use            # reads .nvmrc, Node 20
corepack enable    # for pnpm 9
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed prints a test API key — save it somewhere local.

## Smoke test

```bash
# Health
curl -s http://localhost:4000/healthz | jq .

# Create a cardholder
curl -s -X POST http://localhost:4000/v1/cardholders \
  -H "x-api-key: $FAYAPAY_TEST_API_KEY" \
  -H "content-type: application/json" \
  -d '{"firstName":"Aisha","lastName":"Bello","email":"aisha@test.dev",
       "phone":"+2348012345678","dateOfBirth":"1992-04-10","country":"NG"}'
```

Dashboard is at `http://localhost:3000`. Provider health page shows what's reachable.

## Reading list (in order)

1. [README.md](../../README.md) — what each app does
2. [ADR-0001](../adr/0001-monorepo-layout.md), [0002](../adr/0002-multitenant-schema.md), [0003](../adr/0003-provider-routing.md) — the decisions you'll trip over
3. [packages/ledger/README.md](../../packages/ledger/README.md) — the ledger rules
4. Runbooks. You don't need to memorise them. You need to know they exist.

## Things people get wrong in the first month

- **Forgetting `business_id` on a query.** CI catches most of these. The ones it misses, code review catches. The ones reviewers miss, you'll see in a Linear ticket.
- **Treating provider balance as authoritative.** It isn't. Our ledger is. See [packages/ledger/README.md](../../packages/ledger/README.md).
- **Parsing webhook bodies before verifying signatures.** Use `req.rawBody` on the API. Fastify will not re-serialise correctly.
- **Skipping idempotency keys on payouts.** You will pay someone twice. We have, in production. Don't.
- **Adding a new provider client without a runbook.** Code review will block.

## Your first PR

Pair with your buddy. A safe first PR is a runbook update or a small lint fix. Don't touch ledger code in week 1.
