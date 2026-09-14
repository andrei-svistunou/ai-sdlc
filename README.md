# AI SDLC Platform

AI SDLC Platform is a local control plane for a deterministic, AI-assisted software delivery
workflow. The V0.1 foundation is a pnpm workspace with a Fastify API and a React/Vite web shell.

## Requirements

- Node.js 26 (`.nvmrc` and the root `engines` field document the supported line).
- pnpm 11.10.0, pinned by the root `packageManager` field.

Install the pinned dependencies with:

```sh
pnpm install
```

## Commands

```sh
pnpm dev       # Start the API and web applications in parallel
pnpm dev:api   # Start only the Fastify API
pnpm dev:web   # Start only the Vite web application
pnpm lint
pnpm typecheck
pnpm build
pnpm check     # lint + typecheck + build
pnpm --filter @ai-sdlc/workflow scenario  # Run the executable domain/workflow scenario
```

The API listens on `http://127.0.0.1:3000` by default. `PORT`, `HOST`, and `LOG_LEVEL` may be set
for local development. Its foundation health endpoint is:

```text
GET /health/live
```

It returns `{ "status": "ok" }` and the Fastify logger emits structured JSON records. The API
closes its listener gracefully on `SIGINT` and `SIGTERM`.

## Workspace boundaries

```text
apps/api       Fastify API and V0.1 composition root; CommonJS TypeScript
apps/web       React/Vite control surface; Vite-compatible ESM TypeScript
packages/domain        Framework-independent domain concepts
packages/application   Use cases and provider ports
packages/workflow      Deterministic workflow state machine
packages/contracts     DTOs shared with the web application
packages/config        Typed configuration
packages/observability Logging and correlation context
```

The dependency direction is intentionally one-way:

```text
apps → adapters (later) / application → workflow → domain
web → contracts
```

The domain package does not depend on application, framework, filesystem, HTTP, database, queue,
or provider code. The web application consumes shared contracts rather than backend implementations.
ESLint rules in `eslint.config.mjs` enforce these initial boundaries as packages gain code.

## V0.1 boundaries

This foundation does not include the domain/workflow model, persistence, Git worktrees, Codex
integration, orchestration, authentication, external connectors, databases, queues, workers,
Docker, or automated tests. Those are separate tasks in
[`docs/AI_SDLC_PLATFORM_IMPLEMENTATION_SPEC.md`](docs/AI_SDLC_PLATFORM_IMPLEMENTATION_SPEC.md).
