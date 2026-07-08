# ADR-0012: Accept Modulr's HMAC-SHA1 request signing

- **Status:** Accepted (under protest)
- **Date:** 2025-09-19
- **Reviewers:** secops

## Context

Modulr's Customer API requires every request to be signed with HMAC-SHA1 over a canonical signing string (`date` + `x-mod-nonce`). They publish this in their docs and have indicated no plans to upgrade. We need Modulr for GBP Faster Payments — no equivalent provider is licensed in the UK at our price point.

## Decision

Use HMAC-SHA1 *for outbound request signing only*, scoped to the Modulr client. The signing string includes a nonce and a date header within a 5-minute window, which mitigates the practical attack surface (signature collisions on SHA1 require offline computation; Modulr rejects stale dates).

**Hard constraints:**
- No SHA1 anywhere else. CI lints for `createHmac('sha1'` outside `packages/integrations/modulr/src/`.
- Webhook *inbound* verification uses HMAC-SHA256 (`X-Mod-Hmac-Sha-256` header).
- Track Modulr's API changelog for an upgrade path. Re-open this ADR if they ship SHA-256 request signing.

## Consequences

- Annual secops sign-off required.
- We add a release-gate check that the constraint above still holds.
