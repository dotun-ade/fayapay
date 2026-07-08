# On-call

## Rotations

- `fayapay-platform` — primary platform on-call. 1-week rotation, Mon 09:00 WAT handoff.
- `fayapay-payments` — payments-specific (recon, payouts). 1-week, Mon 09:00 GMT handoff.
- `fayapay-compliance` — KYC + AML. Business hours only.

## SLOs

| Service | SLO                                | Page-out threshold     |
| ------- | ---------------------------------- | ---------------------- |
| API     | 99.95% 5-min availability          | 99.0% over 10m         |
| Worker  | < 5min queue depth (webhook-events)| > 30min depth or 0 rate |
| Payouts | 99.5% within stated SLA per rail   | per-rail policy        |

## First steps in any incident

1. Acknowledge in PagerDuty within 5 minutes.
2. Open the incident channel — `/incident open <name>` in Slack.
3. Read the alert. Find the matching runbook in `docs/runbooks/`.
4. If no runbook matches, page the secondary.

## Things you can do without escalation

- Re-deploy known-good revisions (`fly deploy --image <last-good-image>`)
- Disable a single feature flag via Doppler
- Replay webhook events from the dead-letter set

## Things that require sign-off before acting

- Touching the ledger directly with SQL
- Increasing payout limits
- Disabling a KYC rule that ever rejected a real cardholder
- Force-completing a payout

## Comms

- Internal status: `#incidents`
- External status page: `status.fayapay.app`. Update within 15 min of confirmed customer impact. Use templates in `docs/comms/`.
