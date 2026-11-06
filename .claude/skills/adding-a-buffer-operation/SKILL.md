---
name: adding-a-buffer-operation
description: Add or change a call to Buffer's GraphQL API. Use for ideas, posts, channels or account queries, Buffer errors, rate limits, or token refresh.
---

# Adding a Buffer operation

Quota is shared by every user, judges included, and the handbook's numbers are the budget: 100 per 15 minutes, 250 per day.

1. **Confirm the shape.** Read developers.buffer.com, and test in the Explorer with the owner's OK. Done when you've seen a real success and a real error response.
2. **Save those responses** as fixtures beside the adapter.
3. **Extend the interface** in `core` by role (`BufferGateway`). Go red with a flow test using a fake.
4. **Write the adapter** in `apps/web/src/server/`. Parse responses with Zod. Done when these all map to `AppError`: HTTP 200 with an error inside, 429 (honour `Retry-After`, no retry loop), and plan limits such as `LimitReachedError`.
5. **Decide the cache.** Reads hit our database first. At 80% of quota, reads come from cache only, keeping the rest for writes.
6. **Add the scope** to the OAuth request if needed. Current scopes: `account:read posts:read posts:write ideas:read ideas:write offline_access`.

## Known traps

- `createPost` requires `channelId`, `assets`, `mode`, `needsApproval` and `schedulingType`.
- App clients can't read post metrics, even though other Buffer tools can.
- Tags are never created by this app.
- Testing uses the dev client. Saving to draft (`saveToDraft: true`) avoids publishing for real.
