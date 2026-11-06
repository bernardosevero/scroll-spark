---
name: editing-agents-md
description: Decide where a rule belongs and write it so it holds. Use before changing AGENTS.md, adding or editing a skill, or when a convention keeps getting broken.
---

# Editing AGENTS.md and skills

`AGENTS.md` loads every session, so each line costs every task. Stop at the first home that fits:

1. **Lint or types**, for a pattern a tool can see. Add a case to `tooling/boundaries/boundaries.test.ts`.
2. **A test**, for a behaviour.
3. **A skill**, for one kind of task.
4. **A doc in `docs/`**, for reference, with a line in `AGENTS.md` saying when to read it.
5. **`AGENTS.md`**, for what almost every task needs and nothing above can carry.

## Writing

- State what to do. Leave bans to lint where you can.
- Keep each meaning in one place. Link to it rather than repeating it.
- Skip what `package.json`, config or the folder layout already show. Write the reason, the catch, and what no file admits.
- Every link says when to read it.
- End every step with how you know it's done.
- Delete lines that went stale in the same PR.

## Skills

- Path: `.claude/skills/<verb-ing-noun>/SKILL.md`, with `name` matching the folder.
- The `description` loads every session. Say what it covers and list one trigger per distinct case.
- Add a skill only for a task that's easy to get subtly wrong.
