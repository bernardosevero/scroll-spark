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

**Tables so far:** `users` (also holds the chosen Buffer organization and default channels), `buffer_grants`, `captures`, `analyses`, `buffer_cache`, `buffer_quota`, `extension_tokens`, and the fit check's `channel_profiles` (one row per channel, with `profile_refreshed_at`), `channel_posts` (cleaned text, one-line summary, cluster, real dates) and `channel_clusters`. `analyses` also holds `channels` and `duplicates`, the fit as it was when the analysis ran, both null for older rows, `draft_runs`.

## The fit check

`capture.analyze` runs `fit.prepare` before the model, then `fit.resolve` after it. The model only names things by ID. Every count and date comes from our own `channel_posts` rows.

```mermaid
flowchart TB
  start[analysis.analyze] --> chans[Readable channels of the chosen organization, defaults first, at most 6]
  chans --> fresh{Profile under a day old?}
  fresh -- yes --> use[Use the saved profile]
  fresh -- no --> posts[buffer.posts, one page of 50 per channel, cache and quota first]
  posts --> clean[cleanHistory: drop under 80 characters, merge copies, cut at 500]
  clean --> thin{3 or more usable posts?}
  thin -- no --> save[Save the posts only]
  thin -- yes --> same{Same posts as the saved profile?}
  same -- yes --> save
  same -- no --> llm[One model call: summaries and 5 to 8 clusters]
  llm --> save
  use --> prompt[Summaries and cluster names go to the analysis call]
  save --> prompt
  prompt --> answer[Model returns IDs only]
  answer --> drop[Drop unknown channel, cluster, post and idea IDs]
  drop --> facts[Count posts and read last and next dates from our rows]
  facts --> row[Saved with the analysis]
```

A profile that can't be built leaves that channel as "unavailable" and nothing is saved, so the next analysis tries again. An expired Buffer grant stops the analysis before the model is called. The duplicate check counts matched Ideas (from the cached `buffer.ideas`) and matched scheduled posts.

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

```mermaid
sequenceDiagram
  actor User
  participant Panel as Side panel
  participant BG as Extension background
  participant Page as /extension/connect
  participant API as tRPC route
  participant DB as extension_tokens

  User->>Panel: Sign in on the website
  Panel->>Page: Opens a tab
  User->>Page: Connect the side panel (cookie session)
  Page->>API: extension.connect
  API->>DB: Insert SHA-256 of a new random token, expires in 30 days
  API-->>Page: The token, once
  Page->>BG: runtime.sendMessage(extension ID, token)
  BG->>BG: Check the sender's origin, keep the token in storage.local
  alt The extension didn't answer
    Page->>API: extension.revoke, so no token goes unheld
  end

  Note over Panel,API: Later, from the side panel
  Panel->>API: capture.create with Authorization: Bearer token
  API->>DB: Find by hash. Refuse if revoked or past expires_at
  API-->>Panel: The capture, saved to the same inbox as the website
```

`resolveCaller` in `packages/api/src/context.ts` picks who is calling. A bearer token wins when one is sent, and a bad one signs the request out rather than falling back to a cookie. Minting, listing and revoking tokens accept the website's cookie only, so a stolen token can't renew itself. CORS allows only `EXTENSION_ORIGIN` and never credentials. `/extension/connect` lists the active connections and revokes them.

## Capturing from a page

The background script reads a tab only after the user acts (toolbar icon, shortcut, right-click), which grants `activeTab` for that tab. It injects `capture.js`, an unlisted script that is not in the manifest, and leaves the result in `storage.session` for the panel. The panel always shows it for correction before `capture.create`.

```mermaid
flowchart LR
  act[Toolbar, shortcut or right-click] --> open[Open the side panel]
  act --> inject[Inject capture.js into that tab]
  inject --> order{Selected text?}
  order -- yes --> found
  order -- no --> post{LinkedIn or YouTube post found?}
  post -- yes --> found[Captured text]
  post -- no --> page{Ordinary page?}
  page -- yes --> title[Title and URL] --> found
  page -- no, or markup changed --> empty[Ask the user to select the text]
  found --> review[Panel: correct, then Find the spark]
  empty --> review
```

## The side panel's flow

The panel is a thin client on the same procedures as the website. It holds no product rules: it shows what the API answers and says what failed. The analysis card, fit check, Trends links and draft editor are shared components in `packages/ui` that render props, and the website feeds them the same way. The one decision both hosts needed, which channel to write for, is `chooseChannel` in `packages/core`. The panel never chooses the Buffer organization or default channels. It links to the website's Channels page.

```mermaid
flowchart LR
  review[Review and edit] -- capture.create, capture.analyze --> wait[Finding the spark]
  wait --> card[Analysis card]
  wait -- failed, capture kept --> retry[Message, Try again, inbox link]
  retry --> wait
  card -- capture.saveAsIdea --> saved[Saved to Buffer Ideas]
  card -- Draft a post --> draft
  saved --> draft[Draft editor<br/>buffer.channels, draft.create]
  draft -- post.create, once, never retried --> done[Done]
  draft -- failed, text kept --> draft
  done --> idle[Capture another]
```

A queued post may publish for real, so `post.create` is sent once and never retried. Each expected failure shows its own message and leaves the user's text on screen.

## Where each decision is recorded

- Product: [PROJECT_DEFINITION.md](PROJECT_DEFINITION.md)
- Technical: [adr/](adr/)
- Visual: [design-system.md](design-system.md)
