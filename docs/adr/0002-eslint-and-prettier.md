# 2. ESLint and Prettier over Biome

**Status:** accepted, Nov 6, 2026

PostHog Code uses Biome, which is faster and is one tool instead of two.

**Decision:** ESLint 9 and Prettier. Type-aware rules such as `no-floating-promises` catch the mistakes that are costly around token refresh, `eslint-config-next` covers Next.js, and `no-restricted-imports` enforces layers.

**Consequences:** slower linting. TypeScript stays on 6.0, because `typescript-eslint` doesn't support 7 yet. ESLint stays on 9 for `eslint-config-next`'s plugins. Revisit both after the contest.
