---
name: changing-the-schema
description: Change database tables or migrations with Drizzle. Use for any edit to apps/web/src/server/db/schema.ts or apps/web/drizzle, or a migration conflict after merging main.
---

# Changing the schema

Migrations run on deploy against real user tokens, so changes stay additive: new tables or nullable columns.

1. Edit `apps/web/src/server/db/schema.ts`, with a comment on what each new column holds and what `null` means.
2. Run `pnpm --filter @scroll-spark/web db:generate`. Done when one new `drizzle/NNNN_*.sql` exists. Leave `drizzle/meta` to the tool.
3. Apply it to your Neon **dev** branch: `pnpm --filter @scroll-spark/web db:migrate`.
4. Run `pnpm typecheck` to find code that needs the new field.
5. Update the table list in `docs/architecture.md` if the diagrams mention it.

## Secrets

Tokens are encrypted before they reach a column. Post text is cached, but nothing the user didn't capture or post gets stored.

## Conflict after main moved

Two branches generated the same migration number. Keep main's: restore `drizzle/meta` from `origin/main`, delete your `.sql`, and run `db:generate` again.
