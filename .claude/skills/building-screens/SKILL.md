---
name: building-screens
description: Build or change UI in the website or side panel, including motion and joy moments. Use for pages, components, forms, animation, or anything visual.
---

# Building screens

Creators should enjoy this. Read `docs/design-system.md` first, then build from the flows on the [design canvas](https://claude.ai/artifact/EAAmg5cCVLGi24JhtKxJGc).

1. **Choose the home.** Used by both hosts: `packages/ui`, rendering props only. One host: `apps/web/src/features/<area>` or the side panel folder. Pages stay thin.
2. **Go red.** Extend the Playwright flow, finding things by role and accessible name.
3. **Build with tokens.** Use `bg-cream`, `text-navy`, `shadow-offset-spark` and the shared components. If a token or component is missing, add it to `packages/ui` and to `/system`.
4. **Add motion where it's earned.** The five joy moments get real choreography, and everything else stays calm. Use `DURATION` and `EASE_SPARK`, and animate `transform` and `opacity`.

## Done when

- [ ] Loading, empty and error states exist
- [ ] Motion stays under its time limit and never blocks input
- [ ] With reduced motion on, the screen still says everything
- [ ] Text passes the contrast pairs in the design system, and targets are at least 44px
- [ ] Keyboard focus is visible, with real `button`, `a` and `label` elements
- [ ] It works at phone and side panel width
- [ ] You looked at it in a browser, and it made you a little happy

Copy is short, warm and plain. Fit copy states counts and dates.
