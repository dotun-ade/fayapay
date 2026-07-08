# Changelog

Notable changes only. We don't follow semver — this is a platform, not a library.

## Unreleased

- Initial monorepo layout (ADR-0001)
- Multi-tenant schema with `business_id` (ADR-0002)
- Provider routing service for card issuing, payouts, collections, KYC (ADR-0003)
- Ledger as source of truth, with hourly recon (ADR-0011)
- 7 integration packages: Sudo (issuing), Paystack, Flutterwave (collections + payouts), Wise, Currencycloud, Modulr (USD/EUR/GBP), Dojah (KYC)

## 2026-05

- USD/EUR/GBP card-issuing partner not yet signed; ADR-0003 updated to reflect rails-only on those currencies.
- KYC consolidated to Dojah as sole vendor. Single-vendor risk acknowledged in [docs/runbooks/dojah-degraded.md](docs/runbooks/dojah-degraded.md).

## 2025-11

- Modulr HMAC-SHA1 outbound signing accepted under protest (ADR-0012)

## 2025-06

- Recon thresholds formalised (ADR-0011). Drift > 100k minor units pages on-call.
