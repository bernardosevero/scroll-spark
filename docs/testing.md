# Testing

**Flows first.** Each issue starts with a failing test of the flow it delivers. Writing the test first keeps agents building what a user needs, and proves the test can fail.

Tests never spend money or call real services.

| Area               | How it's tested                                                                 | Where                                       |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------- |
| Product flows      | Flow tests with faked dependencies, written first                               | `core/src/<feature>/<feature>.flow.test.ts` |
| API mapping        | The router called directly                                                      | `packages/api/src/*.flow.test.ts`           |
| Screens            | One Playwright flow with fake Buffer and Claude, extended when a screen changes | `apps/web/e2e/`                             |
| Components         | Behaviour and accessibility                                                     | `packages/ui/src/*.test.tsx`                |
| Buffer adapter     | Saved example responses, including errors inside HTTP 200                       | Beside the adapter                          |
| Refresh-token lock | One test on real Postgres, because it's about concurrency                       | Beside the adapter                          |
| Page capture       | Saved HTML from LinkedIn and YouTube                                            | Beside the extractor                        |
| Layer boundaries   | ESLint run against banned imports                                               | `tooling/boundaries/`                       |

There's no coverage target. The risky logic gets tested properly, and the rest stays quick to change.

## Writing tests

- Name tests for what a user or caller experiences.
- Build services with explicit fakes, and test the decision, not the transport.
- Use `it.each` when cases differ only in inputs and expected results.
- Colocate tests with the code, except browser flows.
- Find elements by role and accessible name in Playwright.

## Before calling work done

1. `pnpm verify`
2. `pnpm e2e`
3. For UI changes, look at the result in a browser, at phone and desktop width, and with reduced motion for animated work.

## Real Postgres

The refresh-lock test runs only when `TEST_DATABASE_URL` is set, as it is in CI. It resets that database, so it refuses any database whose name lacks `test`.

## Real services

Ask the owner before any test run or script that calls real Buffer or Claude. Use the dev app client, so the judging client's quota stays untouched.
