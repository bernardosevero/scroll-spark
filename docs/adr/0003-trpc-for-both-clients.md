# 3. One tRPC API for both clients

**Status:** accepted, Nov 6, 2026

The extension can't call Server Actions, and REST means writing each call and its types twice.

**Decision:** tRPC v11 with TanStack Query. Routers are one-line forwards to services. Website cookies and extension tokens resolve to the same user in the tRPC context. OAuth callbacks and the health check stay as plain route handlers.

**Consequences:** renaming a field shows type errors in both clients. The API isn't meant for third parties.
