# 1. Layered pnpm monorepo with thin hosts

**Status:** accepted, Nov 6, 2026

The website and extension share an API, an analysis card and a draft editor. We adopted the principle from PostHog Code: logic is portable, hosts are thin, and lint enforces the boundaries.

**Decision:** pnpm workspaces and Turborepo, with `apps/web`, `apps/extension`, `packages/core`, `packages/api` and `packages/ui`. Packages ship TypeScript source with no build step, and expose files through `exports`, with no barrels.

**Consequences:** the side panel reuses website UI and flows are testable without a host. Adding a public file means editing `exports`.

**Left out from PostHog:** Inversify, the `Contribution` boot system, Electron layers, Trunk, Quill.
