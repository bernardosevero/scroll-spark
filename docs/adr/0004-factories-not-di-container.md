# 4. Factory functions, no DI container

**Status:** accepted, Nov 6, 2026

PostHog Code's Inversify setup suits a multi-host desktop app. We have two hosts and eight days.

**Decision:** services are `createX(deps)` factories, wired by hand in `apps/web/src/server/composition.ts`.

**Consequences:** no decorators or `reflect-metadata`, and tests pass plain fakes. Wiring is one file to read.
