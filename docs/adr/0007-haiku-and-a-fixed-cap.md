# 7. Claude Haiku and a fixed cap on the bill

**Status:** accepted, Nov 7, 2026

The owner doesn't want an open-ended bill for other people's usage. The contest also requires that a judge can actually use the app, and most judges won't have an Anthropic key. So asking everyone for their own key could cost us eligibility.

**Decision:** use Claude Haiku 5.5 instead of Opus 5.5 for analysis, profiles and drafts, at about 1/40 of the price per token. Hold the account to $5 of prepaid credit with auto-reload off. Limit each user to 10 analyses a day. Users don't bring keys.

**Consequences:**

- $5 is the most the owner can lose, and it should cover roughly 3,000 captures with drafts (an estimate).
- Once the credit runs out, analysis and drafts stop for everyone. Users see the existing "try again" message and their capture stays safe. The daily health check's Claude call fails too, which emails the owner, so they can top up by hand.
- There is no shared cap across users, so one busy day could use up credit meant for judging. Check the balance before judging starts on Nov 16.
- Draft quality on Haiku is unproven until the owner's sample run. If it's too weak, change the model here rather than quietly in code.
