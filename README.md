# Scroll Spark

Capture a post you like while scrolling, see how it fits each of your channels, and turn it into your next post. Built on the Buffer API for the Buffer Commit contest.

**Status:** project skeleton. A `ping` call runs through every layer, and real features start from the first issues.

## Setup

You need Node 24 or later, and pnpm through Corepack.

```bash
corepack enable
```

```bash
pnpm install
```

```bash
cp .env.example apps/web/.env.local
```

```bash
pnpm dev
```

The website runs at http://localhost:3000 and the design system at http://localhost:3000/system.

To open the extension in Chrome, go to `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick `apps/extension/.output/chrome-mv3-dev`. Click its toolbar icon to open the side panel. It should say "pong, side panel".

## Environment variables

| Variable           | Needed                        | What it does                              |
| ------------------ | ----------------------------- | ----------------------------------------- |
| `DATABASE_URL`     | From the first database issue | Neon dev branch connection                |
| `EXTENSION_ORIGIN` | Production                    | The one extension allowed to call the API |
| `LOG_LEVEL`        | No                            | `info`, `warn` or `error`                 |

`apps/web/src/server/env.ts` validates them at startup.

## Commands

| Command                                       | What it does                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`                                    | Runs the website and the extension build                                                     |
| `pnpm verify`                                 | Lint, format check, types, tests, build, unused code                                         |
| `pnpm e2e`                                    | Browser flows. First run: `pnpm --filter @scroll-spark/web exec playwright install chromium` |
| `pnpm format`                                 | Formats everything                                                                           |
| `pnpm --filter @scroll-spark/web db:generate` | New migration from the schema                                                                |

## Architecture

Logic lives in `packages/core`, and the website and extension stay thin. Diagrams are in [docs/architecture.md](docs/architecture.md).

```mermaid
flowchart LR
  ext[Chrome extension] --> api
  web[Website] --> api
  ui[packages/ui] -.-> web
  ui -.-> ext
  api[packages/api] --> core[packages/core]
  server[apps/web/src/server] -. implements .-> core
  server --> buffer[Buffer API]
  server --> claude[Claude API]
  server --> neon[(Neon Postgres)]
```

## Working here

Start with [AGENTS.md](AGENTS.md). Every change begins with a failing flow test.

| Doc                                                      | Holds                                   |
| -------------------------------------------------------- | --------------------------------------- |
| [GLOSSARY.md](GLOSSARY.md)                               | Exact meanings of our words             |
| [docs/PROJECT_DEFINITION.md](docs/PROJECT_DEFINITION.md) | Product decisions and the timeline      |
| [docs/design-system.md](docs/design-system.md)           | Riso Print: colour, type, motion, voice |
| [docs/conventions.md](docs/conventions.md)               | Code patterns                           |
| [docs/testing.md](docs/testing.md)                       | Test strategy                           |
| [docs/adr/](docs/adr/)                                   | Technical decisions and why             |

## License

MIT
