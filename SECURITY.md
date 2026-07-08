# Security

## Reporting a vulnerability

Email `security@fayapay.app` with PGP key `0xA1B2C3D4`. Do not file a public GitHub issue.

We acknowledge within 24h, triage within 72h, and pay bounties per the policy at `fayapay.app/security/policy`.

## What's in scope

- The platform repo (this one)
- The customer-facing dashboards and API
- The mobile apps (separate repos: `fayapay-ios`, `fayapay-android`)
- The embed SDK (`fayapay-js`)

## What's out of scope

- Third-party provider security (Sudo, Marqeta, Stripe, etc) — report to them
- Social engineering of Fayapay staff
- DoS / volumetric attacks

## Secrets handling

- Production secrets live in Doppler. Read access requires SSO + a documented justification.
- No secrets in code, `.env` files in repo, or chat. CI rejects `.env` and `*.pem` outside `secrets/` (which is gitignored).
- Provider API tokens are rotated on offboarding. See [docs/runbooks/rotate-provider-keys.md](docs/runbooks/rotate-provider-keys.md).
