# ADR-0003: Provider routing

- **Status:** Accepted (revised 2026-05-14)
- **Date:** 2024-05-22

## Context

We use multiple providers across "rails" (issuing, collections, payouts, FX, KYC). Routing is driven by currency, geography, available product, and degradation state.

## Decision

Routing tables live in code (`apps/api/src/services/*-router.ts`), gated by LaunchDarkly-style feature flags persisted in `.env` for local dev. Per-provider toggles let us de-route during incidents.

### Card issuing

| Currency        | Primary issuer       | Notes                                                  |
| --------------- | -------------------- | ------------------------------------------------------ |
| NGN             | Sudo Africa          | Verve is the only domestic-acceptance option.          |
| KES             | Sudo Africa          |                                                        |
| GHS             | Sudo Africa          |                                                        |
| ZAR             | (none)               | Tracking RegTech licence renewal. ETA 2026-Q4.         |
| USD / EUR / GBP | (none)               | Issuing partner not yet signed. Rails are funded; issuance is not. |

### Collections (pay-in)

| Currency | Primary       | Fallback     |
| -------- | ------------- | ------------ |
| NGN      | Paystack DVA  | Flutterwave  |
| KES      | Flutterwave   | —            |
| GHS      | Flutterwave   | Paystack     |
| ZAR      | Flutterwave   | —            |
| EUR      | Currencycloud | Wise         |
| GBP      | Modulr (FPS)  | Currencycloud |

### Payouts (pay-out)

| Currency      | Primary   | Notes                                                                |
| ------------- | --------- | -------------------------------------------------------------------- |
| NGN           | Paystack  |                                                                      |
| KES/GHS/ZAR/UGX/TZS/RWF | Flutterwave |                                                          |
| USD/EUR       | Wise      | SWIFT/SEPA via Wise Platform.                                        |
| GBP           | Modulr    | Faster Payments; Wise as fallback when Modulr degraded.              |

### KYC

Dojah is the sole identity vendor. BVN and NIN lookups go to Dojah's `/kyc/bvn/full` and `/kyc/nin`. Business verification via `/kyc/business` for CAC numbers. Any non-BVN/NIN id type is parked in `IN_REVIEW` and worked manually — see [docs/runbooks/dojah-degraded.md](../runbooks/dojah-degraded.md).

Adding a second vendor is on the roadmap — we hit single-vendor risk every time Dojah ships a regression.

## Consequences

- Routing logic is centralised — adding a country is a one-file change.
- KYC has zero failover today. We accept this for now; new submissions queue during Dojah outages and on-call works the backlog manually.
- Multi-provider acquiring on the same currency requires explicit settlement-account splits (see [docs/runbooks/recon.md](../runbooks/recon.md)).
