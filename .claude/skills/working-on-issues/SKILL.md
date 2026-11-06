---
name: working-on-issues
description: The loop from GitHub issue to PR, flow test first. Use when asked to work on an issue, implement a feature, or fix something with an issue.
---

# Working on an issue

1. **Read.** `rtk proxy gh issue view <N> --json title,body,comments`. Turn each acceptance criterion into a line of a test list. Done when every criterion has a test or a named manual check.
2. **Branch.** `git switch -c feat/<short-name> origin/main`, using `fix/`, `docs/` or `chore/` where they fit.
3. **Go red.** Write the flow test in `core`, and extend `apps/web/e2e/` if a screen changes. Run them. Done when each fails for the expected reason.
4. **Go green.** Follow "Where code goes" in `AGENTS.md`. Reach for the matching skill: `changing-the-schema`, `adding-a-buffer-operation`, `changing-ai-prompts`, `writing-an-extractor`, `building-screens`.
5. **Check.** `pnpm verify` and `pnpm e2e` pass. For UI, look at it in a browser.
6. **Hand off.** Update `docs/architecture.md` if a layer, table or external service changed. Open a PR with `.github/pull_request_template.md`, conventional commits and `Closes #N`.

The owner merges. Stay inside the issue's scope, and open a new issue for anything extra you find.
