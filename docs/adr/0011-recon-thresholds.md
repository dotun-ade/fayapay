# ADR-0011: Reconciliation thresholds

- **Status:** Accepted
- **Date:** 2025-06-01

We treat our ledger as truth. Providers' balances drift; we reconcile them.

| Drift size (minor units, absolute) | Action                                              |
| ---------------------------------- | --------------------------------------------------- |
| ≤ 100                              | Auto-correct, log, no ticket.                       |
| 101 – 10_000                       | Open Linear ticket (`recon-low`). Resolved < 7d.    |
| 10_001 – 100_000                   | Page payments on-call. Resolve < 24h.               |
| > 100_000                          | Page on-call + CFO. Halt new payouts on that rail.  |

Time-since-drift adds a multiplier — anything > 24h auto-escalates one tier.

The recon worker runs hourly; thresholds checked in `packages/ledger/src/balances.ts::reconcileAllAccounts`.
