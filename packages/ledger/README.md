# @fayapay/ledger

Double-entry ledger. Source of truth for balances.

## Rules

1. Every posting is balanced: sum of debits = sum of credits, per currency, within a `txGroupId`.
2. All entries belong to a `Account` (typed: WALLET, SETTLEMENT, CARD_FUNDING, FX_BUFFER, FEE).
3. Transactions are append-only. Reversals post a new opposing entry, with `referenceType = "reversal"`.
4. Balances are derived from ledger entries. The `accounts.available_balance` denorm is rebuilt by a trigger and is **never authoritative** — recompute from entries when in doubt.
5. Provider events trigger postings; they don't *become* postings. The webhook handler resolves the affected accounts, then calls `ledger.post()`.

## Account types

| Type           | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `WALLET`       | Cardholder spendable balance.                                           |
| `COLLECTION`   | Provider-held funds in flight (e.g. Paystack settlement queue).         |
| `SETTLEMENT`   | Our bank account at the provider — settled, withdrawable.               |
| `CARD_FUNDING` | Funds reserved for an issued card's authorized spend.                   |
| `FX_BUFFER`    | Per-currency house position from FX conversions.                        |
| `FEE`          | Internal account — fee revenue.                                         |

## Why we don't use the provider's balance

Providers reconcile asynchronously. Their balance lags ours by anywhere between seconds (Stripe) and 30 minutes (Paystack settlement). We treat their balance as a target we recon against, not as the truth.

When ours and theirs disagree:
- gap < 24h, < $1: log, do nothing
- gap > 24h or > $1: open recon ticket via the `recon` queue
- gap > $100: page on-call (`recon-anomaly` alert)
