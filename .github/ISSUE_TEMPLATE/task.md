---
name: Task
about: One piece of work, written so an agent can finish it from this issue alone
title: "feat(area): what the user can now do"
---

## Goal

What a user can do once this ships, in one or two sentences.

**Depends on:** issues this needs, and what each provides.
**Blocks:** issues waiting on this.
**Target:** the date, and why it's that date.

## What exists today

Files and functions to build on, by path. Say what's missing, too.

## Build

Each layer, with paths and suggested names: `core` service and interfaces, API procedures, adapters, tables, screens. Say which skill to follow.

Mark anything not yet confirmed, and how to confirm it.

## Rules

The product rules, API shapes, limits, exact copy and states this work needs. Write them here, even when a doc also holds them, and name that doc.

## Test list

Each flow test as a checkbox, grouped by where it lives, starting with the ones to write red first. List manual checks separately.

## Owner approval

Real Buffer, Claude or paid calls this needs, and what to use meanwhile. Delete this section if there are none.

## Out of scope

Nearby work that belongs elsewhere, with its issue number.

## Done when

- Everything in the test list passes, plus `pnpm verify` and `pnpm e2e`
- UI looked at in a browser at phone and desktop width
- `docs/architecture.md` updated if a layer, table or external service changed
- PR says `Closes #N`
