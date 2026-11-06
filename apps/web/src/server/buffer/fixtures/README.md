# Buffer fixtures are UNVERIFIED

Every file here was **written by hand** from the shapes in issue #4 and the public reference at
developers.buffer.com. None is a recorded response. Issue #2 (the owner's Explorer tests) has not
posted real ones yet.

Until they are replaced, passing adapter tests only prove that the adapter agrees with these guesses.
When #2 lands, replace each file with the real response (tokens and account details removed) and
re-run the adapter tests. Fix the adapter, not the fixture, if they disagree.

Things nobody has confirmed against Buffer:

- Every field selected in `buffer-gateway.ts`, mostly the `ideas` node (`id content { title text }`),
  `limits` types, and the `posts` sort enum values (`dueAt`, `desc`).
- The input type names `ChannelsInput`, `PostsInput`, `IdeasInput`, `CreateIdeaInput` and
  `CreatePostInput`. The reference page confirms `ChannelsInput`, `PostsInput` and `CreatePostInput`;
  `IdeasInput` and `CreateIdeaInput` are guesses.
- The `Service` enum spelling for channels (`twitter` or `x`, and whether Substack exists).
- Whether `createIdea` needs `tags: []`, and what `assets` looks like for a text-only post.
- That typed errors arrive as `{ "__typename": "LimitReachedError" }` inside HTTP 200. The error type
  names are from the reference, the payload shape is assumed.
- Added with #8 (save ideas, draft, create posts), all unconfirmed:
  - That a draft is sent as `mode: "addToQueue"` with `saveToDraft: true`, and that Buffer then
    saves a draft rather than queueing. `mode` is required, so drafts need some value, and
    `addToQueue` is the least risky.
  - That a queued post sends `saveToDraft: false`, and what `addToQueue` does on a channel with no
    posting slots (it is shown as a generic "wouldn't add this" message).
  - That `schedulingType: "automatic"` is a valid value, and that `assets: {}` is how "no media"
    looks (the issue wrote `assets: []`).
  - That sent posts have `status: "sent"` or a non-null `sentAt`. Voice samples rely on this.
  - The per-channel character limits in `core/src/ship/limits.ts`, and how X counts links and
    non-Latin text.
  - Whether the idea's `title` is shown by Buffer, since the topic is also in the text.
- The `RateLimit` and `RateLimit-Policy` header format, copied from the issue's example.
- The exact body of a 429 and of a 401.
