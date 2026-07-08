# Runbook: rotate provider API keys

Quarterly + after any departure with secrets access.

## Order matters

Some providers regenerate the key immediately, invalidating the old one. Use the *grace-period* trick where available:

| Provider       | Grace period | Notes                                                |
| -------------- | ------------ | ---------------------------------------------------- |
| Sudo Africa    | None         | Coordinate maintenance window.                       |
| Paystack       | None         | Maintenance window. Webhooks survive (separate secret). |
| Flutterwave    | None         | Maintenance window. Webhook secret separate.         |
| Wise           | 24h          | Token-level rotation.                                |
| Currencycloud  | None         | Login + key both rotated together.                   |
| Modulr         | 24h          | HMAC secret separate; rotate both during quarterly.  |
| Dojah          | None         | Quick — < 1 min.                                     |

## Steps

1. Generate new key on the provider dashboard.
2. `doppler secrets set <NAME>=<value> --config prd`.
3. `fly deploy -a fayapay-api` + `fayapay-worker`.
4. Confirm health: dashboard → Provider health, error rate stable for 10 min.
5. Revoke old key on the provider dashboard.
6. Log the rotation in [docs/security/key-rotation-log.md](../security/key-rotation-log.md).
