# ADR-0002: Multi-tenancy via `business_id` column

- **Status:** Accepted
- **Date:** 2024-04-19

## Context

Fayapay is a B2B platform. Each customer (a "Business") issues cards to *their* end-users (Cardholders). We considered three options:

1. **One DB per tenant** (Citus / one cluster each)
2. **One schema per tenant** in shared Postgres
3. **Shared schema with `business_id` everywhere**

## Decision

Option 3. Every row carries `business_id` (or transitively reaches one). Row-level isolation enforced in the application layer: all queries derived from an authenticated request scope the `WHERE business_id = $1`. We also add a Postgres RLS policy per table as a backstop, gated to the `app_user` role.

## Consequences

- Cheap operationally — one Postgres, one migration set.
- A bug that forgets `business_id` is a tenant-isolation incident. We have a query lint (`@fayapay/db/lint`) that fails CI when a prisma query against a tenant table omits `business_id`.
- Cross-tenant analytics is easy.
- We can't lift a single tenant out for a regulatory request without a per-tenant export job. We have one, but it's slow.

## Notes

We considered Neon branches for tenant isolation when we revisit this in 2027.
