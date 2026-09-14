# ADR 0002: Keep dependency direction explicit

- Status: Accepted
- Date: 2026-09-14

## Decision

Core packages follow the approved dependency direction: `workflow` may use `domain`, `application`
may use `workflow` and `domain`, adapters will implement application ports, and the web application
will consume `contracts` rather than backend implementations.

## Context

Workflow control must remain deterministic and provider-neutral. Keeping framework, transport,
filesystem, and provider knowledge at the edges prevents later adapters from leaking into domain
or workflow code.

## Consequences

- Every package exposes a public root entry point through `exports`.
- ESLint restrictions in `eslint.config.mjs` fail forbidden imports in the initial package layers.
- Later tasks must add contracts and wiring without bypassing package public entry points.
