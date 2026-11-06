# Architecture

**Logic is portable, hosts are thin.** Business decisions live in `packages/core` and reach the outside world through interfaces. The website and extension only boot, wire and render.

Solid boxes exist today. Dashed boxes arrive with their issues. Update these diagrams in the same PR as any change to a layer, table or external service.

## System map

```mermaid
flowchart TB
  subgraph browser[In the browser]
    panel[Extension side panel]
    site[Website pages and features]
    ui[packages/ui<br/>tokens and components]
  end

  subgraph vercel[apps/web on Vercel]
    route[tRPC route handler]
    api[packages/api<br/>one-line routers]
    core[packages/core<br/>services and schemas]
    comp[server/composition.ts<br/>the wiring]
    adapters[server adapters]
  end

  ui --> panel
  ui --> site
  panel -- typed client, bearer token --> route
  site -- typed client, session cookie --> route
  route --> api --> core
  comp -- builds services with --> adapters
  comp --> core
  adapters -. implements interfaces .-> core
  adapters -- one gateway, cache and quota first --> buffer[Buffer GraphQL API]
  adapters --> claude[Claude API]
  adapters --> db[(Neon Postgres)]
  adapters -- link reader, SSRF checked --> web[YouTube oEmbed and public pages]
```

**Tables so far:** `users` (also holds the chosen Buffer organization and default channels), `buffer_grants`, `captures` (with `buffer_idea_id`, the only trace of a saved Idea), `analyses`, `draft_runs` (one row per draft requested, no text, for the daily limit), `buffer_cache`, `buffer_quota`.

## Every Buffer call

`api.buffer.com` is reached from one place, `server/buffer/buffer-gateway.ts`. The shared app-client quota is the thing being protected, so `core/src/buffer/buffer.service.ts` decides between cache and network before the gateway is used.

```mermaid
flowchart TB
  call[Read or write from a service] --> kind{Read or write?}
  kind -- read --> fresh{Fresh in buffer_cache?}
  fresh -- yes --> done[Return the cached answer]
  fresh -- no --> busy{Any window at 80% of its budget?}
  busy -- yes, stale copy exists --> done
  busy -- yes, nothing cached --> limited[BUFFER_RATE_LIMITED]
  busy -- no --> token[auth.getAccessToken]
  kind -- write --> token
  token -- RECONNECT_REQUIRED --> stop[Pass through, no Buffer call]
  token --> gateway[One request, no retry]
  gateway --> quota[Save RateLimit headers in buffer_quota]
  quota --> after{Read or write?}
  after -- read --> store[Save in buffer_cache]
  after -- write --> clear[Clear the matching cache keys]
  gateway -- 429 --> limited
  gateway -- HTTP 200 with a typed error --> failed[AppError]
```

Cache lifetimes: account and channels 1 hour, ideas 15 minutes, posts 24 hours. The budget per window is the lower of the header quota and the handbook's (100 per 15 minutes, 250 per day, 3,000 per 30 days). Windows are matched by their length in seconds. Writes are never gated by the 80% rule and never retried.

## Deleting a user's data

`account.deleteMyData` calls the `account` service in `core`, which deletes the `users` row. Grants, captures and analyses cascade from it, so every new table that holds user data must reference `users` with `onDelete: "cascade"`. The page then posts to `/api/auth/disconnect?deleted=1`, which clears the session and returns to the landing page.

Buffer documents no endpoint for an app to revoke its own grant, only the user removing the app in their Buffer account settings, so Settings tells the user to do that too.

`account.status` tells the shell whether to show "Reconnect Buffer". The shell also shows it when any call fails with `RECONNECT_REQUIRED`.

## Reading a link safely

`capture.readLink` makes our server fetch a URL the user chose, so `server/capture/safe-get.ts` guards it. It uses `node:http` because a custom `lookup` checks each address at the moment of connecting, which leaves no gap for a host to pass a check and then rebind to a private address.

```mermaid
flowchart LR
  url[User's link] --> kind{Which site?}
  kind -- LinkedIn --> paste[Ask for pasted text]
  kind -- YouTube --> oembed[oEmbed]
  kind -- Anything else --> page[Open Graph tags]
  oembed --> check[Scheme, port, no credentials, no IP literal, public address, on each redirect]
  page --> check
  check -- refused or nothing useful --> paste
  check -- readable --> field[Fill the field for correction]
```

## From scroll to shipped post

```mermaid
sequenceDiagram
  actor User
  participant Client as Side panel or website
  participant API as packages/api
  participant Core as core services
  participant DB as Neon
  participant Claude
  participant Buffer

  User->>Client: Shortcut, right-click or paste
  Client->>User: Show captured text to correct
  User->>Client: Find the spark
  Client->>API: capture.analyze
  API->>Core: analyze(text)
  Core->>DB: Save capture, read channel profiles
  Core->>Claude: Summary, angle, matches
  Claude-->>Core: Structured analysis
  Core->>Core: Validate IDs, count, read dates
  Core-->>Client: Fit per channel and Trends links
  User->>Client: Save idea
  Client->>API: capture.saveAsIdea
  API->>Core: saveAsIdea(captureId)
  Core->>Buffer: createIdea
  User->>Client: Draft a post
  Client->>API: draft.create
  API->>Core: draft(angle, summary, voice samples)
  Core->>Claude: Write in this channel's voice
  User->>Client: Edit, then Save as draft or Add to queue
  Client->>API: post.create
  API->>Core: createPost(text, ideaId)
  Core->>Buffer: createPost
```

Capturing never calls Buffer. Only an explicit save or post writes there, which protects the shared quota and keeps Ideas boards clean.

## Saving, drafting and posting

`core/src/ship/ship.service.ts` owns the last three steps. It reaches Buffer only through `BufferService`, and Claude only through the `DraftWriter` interface (the adapter is `server/llm/anthropic-drafter.ts`).

```mermaid
flowchart TB
  save[capture.saveAsIdea] --> saved{captures.buffer_idea_id set?}
  saved -- yes --> same[Return it, no Buffer call]
  saved -- no --> idea[createIdea: topic, summary, angle, source link, Trends links, tags empty]
  idea --> keep[Keep only the idea ID]

  draft[draft.create] --> limit{Under the daily draft limit?}
  limit -- no --> stop[DRAFT_LIMIT_REACHED]
  limit -- yes --> posts[Cached posts for that channel]
  posts --> voice[Up to 8 sent posts, 80+ characters, first 500 each]
  voice --> brief[Brief: angle, summary, topic, channel, limit, samples. Never the source text]
  brief --> writer[DraftWriter, no tools]
  writer --> text[Draft text in the editor]
  text --> overlap[findOverlap against the source, locally, no model]

  post[post.create] --> check{Supported channel and within its limit?}
  check -- no --> refused[CHANNEL_NOT_SUPPORTED or POST_TOO_LONG]
  check -- yes --> once[createPost once, never retried]
  once --> kind{Which button?}
  kind -- Save as draft --> d[saveToDraft true]
  kind -- Add to queue --> q[mode addToQueue]
```

Two identical clicks that arrive while the first is still running share one call, within a server. Drafts are not stored: they live in the editor until posted, and `draft_runs` only counts requests. A draft is counted before the model is called, because a refused or failed one may still cost money.

## OAuth and token refresh

```mermaid
sequenceDiagram
  participant Browser
  participant Web as apps/web
  participant DB as Neon
  participant Buffer as auth.buffer.com

  Browser->>Web: Connect your Buffer account
  Web->>Browser: Encrypted SameSite=Lax cookie with state and PKCE verifier
  Browser->>Buffer: Authorize
  Buffer->>Web: Callback with code and state
  Web->>Buffer: Exchange code, secret and verifier
  Buffer-->>Web: Access and refresh tokens
  Web->>DB: Store tokens encrypted

  Note over Web,DB: Later, when the access token expires
  Web->>DB: UPDATE sets refreshing_until, if the lock is free
  alt This request won the lock
    Web->>Buffer: Refresh, once
    Buffer-->>Web: New tokens. The old refresh token is now dead.
    Web->>DB: Save new tokens at once, release lock
  else Another request holds the lock
    Web->>DB: Wait, then read the new token
  end
  opt Refresh failed, its result is unclear, or an earlier lock expired unfinished
    Web->>Browser: Show Reconnect Buffer
  end
```

## Extension sign-in

The extension opens a tab on our website, which uses the normal session and sends back a token through `externally_connectable`. The token is random, revocable, valid for 30 days, and stored only as a hash on our server. It never gives direct access to Buffer.

## Where each decision is recorded

- Product: [PROJECT_DEFINITION.md](PROJECT_DEFINITION.md)
- Technical: [adr/](adr/)
- Visual: [design-system.md](design-system.md)
