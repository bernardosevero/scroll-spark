---
name: changing-ai-prompts
description: Change Claude prompts, output schemas, models or effort. Use for analysis, clusters, channel profiles, drafting, voice matching, or refusals.
---

# Changing AI prompts

Read the `claude-api` skill first. The API changes often, so check model IDs and parameters there rather than from memory.

Defaults: `claude-haiku-5-5` through `@anthropic-ai/sdk` with `messages.parse()`, `low` effort for analysis and `medium` for drafts.

1. **Change the schema first** in `core`, and go red with a flow test using a fake LLM.
2. **Change the prompt** in the adapter. Captured text is wrapped and described as untrusted data. The model gets no tools.
3. **Keep code in charge of facts.** The model returns IDs. Code validates them and calculates every count and date.
4. **Try real samples, with the owner's OK.** A real run costs money. Use a small saved set: on-niche post, new topic, thin history, Portuguese, prompt injection. Done when you've read each output yourself.
5. **Handle `refusal`** as `AppError("LLM_REFUSED")`, keeping the capture safe.

## Rules

- Drafts receive the angle and summary, never the source text.
- Voice comes from up to 8 cleaned posts on the target channel. With fewer than 3, say so instead of faking it.
- Language defaults to that channel's latest post, and drafts are never bilingual unless asked.
- Trend phrases are 1 to 3 common words, since specific ones come back empty on Google Trends.
- Output states counts and dates, never predicted success.
