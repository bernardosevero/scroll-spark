# 5. Flow tests first

**Status:** accepted, Nov 6, 2026

The owner wants agents to test flows first and write code after, so work stays anchored to what users do.

**Decision:** every issue starts with a failing flow test in `core`, with fakes. When a screen changes, the Playwright flow is extended first too.

**Consequences:** agents see red before green. A browser test isn't required for every small step, since that would be too slow for the timeline.
