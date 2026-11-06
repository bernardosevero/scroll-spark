# Scroll Spark

A website and Chrome extension that lets creators capture a post while scrolling, checks how it fits each of their channels, and turns it into a Buffer idea and post. Built for the Buffer Commit contest: **the deadline is Nov 13, 2026, 11:59 p.m. PT, and submissions can't be changed.**

The website decides eligibility, so it stays complete on its own. The extension is a thin client on the same API. **UI and motion are a main focus**: creators should enjoy using this.

## Read before you start

| Read                                                     | When                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [GLOSSARY.md](GLOSSARY.md)                               | Naming anything. Use these words in code, UI and issues.                             |
| [docs/architecture.md](docs/architecture.md)             | Adding a layer, service, table or external call. Update its diagrams in the same PR. |
| [docs/PROJECT_DEFINITION.md](docs/PROJECT_DEFINITION.md) | Any product question. Its decisions are settled.                                     |
| [docs/design-system.md](docs/design-system.md)           | Any UI or motion change.                                                             |
| [docs/conventions.md](docs/conventions.md)               | Writing services, errors, hooks or imports.                                          |
| [docs/testing.md](docs/testing.md)                       | Deciding what to test and how.                                                       |
| [docs/adr/](docs/adr/)                                   | Before reversing a technical decision. Write a new ADR to change one.                |

## Flow first

Every change starts from the flow it serves.

1. Write a failing **flow test**: `<feature>.flow.test.ts` in `core`, with fakes. Watch it go red.
2. If a screen changes, extend the Playwright flow in `apps/web/e2e/` and watch that go red too.
3. Write the code that turns them green. Then refactor.

A change is done when `pnpm verify` and `pnpm e2e` pass, and you've looked at any UI change in a browser.

## Where code goes

Logic is portable. Hosts are thin. Lint enforces the arrows.

| Place                   | Holds                                                                             | Reaches                    |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| `packages/core`         | Services, schemas, decisions, and interfaces for what they need                   | `zod` only                 |
| `packages/api`          | tRPC routers that forward to services in one line; the typed client               | `core`                     |
| `packages/ui`           | Tokens and components that render props                                           | Nothing in the repo        |
| `apps/web/src/server`   | Real adapters (Buffer, database, Claude, auth) and the wiring in `composition.ts` | Everything server-side     |
| `apps/web/src/app`      | Thin pages and route handlers                                                     | `features`, `server`, `ui` |
| `apps/web/src/features` | Website-only components                                                           | `api` client, `ui`         |
| `apps/extension/src`    | Side panel, service worker, page capture                                          | `api` client, `ui`         |

- **New logic?** A `core` service, built by a `createX(deps)` factory.
- **New outside call?** An interface in `core`, an adapter in `src/server`, a fake in the test.
- **New shared UI?** `packages/ui`, listed in its `package.json` `exports`.

## Rules with no lint behind them

- Real Buffer, Claude and paid calls need the owner's OK first. Tests use fakes and saved responses.
- Buffer quota is shared by every user, judges included. Read the cache first and use the dev client for testing.
- Refresh tokens are single-use. Take the row lock, save the new token at once, and show "Reconnect Buffer" when a refresh fails or its result is unclear. Reusing one logs the user out.
- Fit copy states counts and dates, never predicted success. App clients can't read post metrics.
- Drafts receive the angle and summary, never the source text.
- No "Buffer" in the app's name or icon, and no Buffer look-alike styling. "Built on the Buffer API" is fine.
- Code, comments and docs are in English.

## Commands

`package.json` lists them. `pnpm verify` runs everything except browser flows; `pnpm e2e` runs those.

## Workflow

Each piece of work is one GitHub issue, one branch (`feat/…`, `fix/…`, `docs/…`, `chore/…`) and one PR with conventional commits. The owner merges once CI is green. Use `/working-on-issues`.

Skills live in `.claude/skills/` and trigger by task.

## Gotchas

- Next.js 16 differs from older versions. Read `apps/web/node_modules/next/dist/docs/` before using a routing, caching or instrumentation API.
- OAuth redirect URIs must match exactly and use HTTPS, so OAuth runs on localhost and production only, never Vercel previews.
- The owner's Windows home path contains `á`. Quote paths in scripts.
- Plain `gh` output can come back filtered through the `rtk` hook. Use `rtk proxy gh …` if it looks empty.
