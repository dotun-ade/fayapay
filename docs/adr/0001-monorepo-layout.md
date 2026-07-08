# ADR-0001: Monorepo layout

- **Status:** Accepted
- **Date:** 2024-03-08

## Context

We started with two repos (`fayapay-api`, `fayapay-issuer-bridge`) and immediately hit cross-version drift in shared types. Provider clients ended up duplicated.

## Decision

Single pnpm workspace monorepo. Apps in `apps/*`, libraries in `packages/*`, one package per external provider under `packages/integrations/*`.

## Consequences

- One PR can change the schema, the API, and the worker. Reviewer can see the whole blast radius.
- `pnpm install` is slow on cold cache.
- We use `transpilePackages` in Next so the dashboard can import workspace packages directly without a build step.
- We don't have a publish pipeline. Internal packages are `private: true` forever.
