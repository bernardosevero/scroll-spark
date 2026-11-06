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
  adapters --> buffer[Buffer GraphQL API]:::planned
  adapters --> claude[Claude API]
  adapters --> db[(Neon Postgres)]
  adapters -- link reader, SSRF checked --> web[YouTube oEmbed and public pages]

  classDef planned stroke-dasharray: 6 4
```

**Tables so far:** `users`, `buffer_grants`, `captures`, `analyses`.

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
