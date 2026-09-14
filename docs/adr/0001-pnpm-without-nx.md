# ADR 0001: Use pnpm workspaces without Nx

- Status: Accepted
- Date: 2026-09-14

## Decision

V0.1 uses native pnpm workspaces and does not add Nx, Turborepo, or another task runner.

## Context

The first release needs a small, buildable monorepo for one API and one web application plus
framework-independent packages. Native recursive pnpm scripts are sufficient for this size and
keep the repository close to the approved architecture.

## Consequences

- Workspace membership is declared in `pnpm-workspace.yaml`.
- Internal package boundaries remain explicit through package names and `exports` fields.
- A task runner can be reconsidered later if measured build or CI costs justify it.
