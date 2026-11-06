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
- The `RateLimit` and `RateLimit-Policy` header format, copied from the issue's example.
- The exact body of a 429 and of a 401.
