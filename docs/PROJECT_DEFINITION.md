# Project Definition: Scroll Spark

> **Status:** grilled and decided on Nov 6, 2026. Treat the decisions here as settled unless a test in §13 proves one wrong.
>
> **[Handbook]** marks a fact from Buffer's _Buffer Commit – Developer Handbook_. **[Docs]** marks a fact from developers.buffer.com. Where the two disagree, §9 says so.

---

## 1. Context: Buffer Commit contest

| Milestone         | Date                                     |
| ----------------- | ---------------------------------------- |
| Build window      | Oct 28 – **Nov 13, 2026, 11:59 p.m. PT** |
| Judging starts    | Nov 16                                   |
| Winners announced | Dec 7                                    |

**The ask [Handbook]:** _"build a web app or an integration that makes creating and publishing content noticeably better, using the Buffer API to power at least one of its core features."_

**Judging criteria:** usefulness, execution & craft, creativity. Judges: Joel Gascoigne, Amanda Marochko, Joe Birch.

**Hard eligibility rules:**

1. Must be an **app client** using OAuth that lets any Buffer user connect. A personal API key is only for prototyping. **[Handbook]**
2. **Live at a public URL through the whole judging period**, and a judge must be able to actually use it. **[Handbook]**
3. Makes real Buffer API calls that power a core feature.
4. Entrant is 18+. This is a **solo build**.

**Submission contents [Handbook]:** app **client ID** (never the secret) · team details · public app URL · **2-minute demo video** (real product, no slides; show where the Buffer API is used) · **300-word summary** (origin of the idea, the problem, **what you'd improve after the hackathon**) · optional build-in-public posts (must mention Buffer Commit). **Submissions can't be changed once sent.**

**Branding rules [Handbook]:** no "Buffer" in the app name, no Buffer logo in the icon, don't style the app to look like Buffer. "Built on the Buffer API" and "Connect your Buffer account" are fine.

Help: `#buffer-commit-support` on Buffer's Discord (fastest on weekdays).

---

## 2. The product in one sentence

A **web app plus a companion Chrome extension** that lets creators **capture a post they like while scrolling**, has **AI turn it into a categorized content idea** with a **per-channel "does this fit?" signal** and **Google Trends links**, saves it to **Buffer Ideas**, and turns it into a **real Buffer post without leaving the page**.

**Priority:** the website is the submission and decides eligibility. The extension is a thin client on the same API. If time runs short, the extension shrinks and the website stays complete.

## 3. Problem and user

- **User:** solo creators, founders and social media managers who already use Buffer.
- **Problem:** inspiration shows up while scrolling, then gets lost. Even when it's saved, there's no quick way to judge whether it's worth posting, and turning it into a post means switching apps.
- **Why Buffer:** Buffer Ideas is where content starts and Posts is where it ships.
- **How it differs from Buffer's existing extension:** that one shares a page to your queue. This one captures an idea, categorizes it, checks it against what each channel already posts, links demand data, and drafts a post in your voice.

## 4. Core user flow (MVP)

1. **Sign in (website):** "Connect your Buffer account" starts OAuth. The user picks an organization (skipped if there's only one) and default channels.
2. **Capture:**
   - **Website:** paste text (primary). URLs are only enriched where that works: YouTube oEmbed for title and author, Open Graph tags for public pages, with SSRF protection. Anything else, including LinkedIn, shows "paste the text". "Try an example" buttons let a judge reach the analysis in one click.
   - **Extension:** toolbar click, right-click menu or keyboard shortcut. It captures selected text first, otherwise the post nearest the middle of the screen. The panel shows the captured text so the user can correct it before analysis.
   - No native "like" hooks, background reading, or injected buttons in the MVP.
3. **Inbox:** captures live in our database. Nothing is written to Buffer yet.
4. **Analyze (AI):** topic, angle and 1–3 Google Trends phrases, plus cluster and matching posts per channel (§7).
5. **Fit check:** per channel, for example "Fits LinkedIn (3 posts, last on Sep 29), new for G(Old) Times".
6. **Demand:** "View on Google Trends" links per phrase, plus "compare all" (§8).
7. **Save:** an explicit click creates a Buffer Idea. After that Buffer owns the idea and we keep only its ID, with no two-way sync.
8. **Draft and ship:** the AI drafts for the selected channel from the angle and summary. The user edits. **"Save as draft" is the primary button**, and "Add to queue" is an explicit second button that names the channel. Both use `createPost` with `ideaId`.

## 5. Scope

**MVP (must ship by Nov 13):**

- Website: OAuth, org and channel picker, capture, inbox, analysis, per-channel fit check and clusters, Trends links, draft editor, create idea, create post
- Chrome extension (MV3, side panel): capture on LinkedIn and YouTube plus selected text on any page; capture → review → analysis card → save idea → short draft → post
- Landing page with privacy note and install instructions
- Daily health check

**Stretch (cut first):**

- Injected "Capture" button (optional host permissions)
- Inbox sorting by fit, filtering by topic
- More platforms (X, Reddit, Instagram web)

**After the hackathon (name in the 300-word summary):**

- "Other X creators are talking about this", counted across our own users. It needs real user volume, a privacy threshold of about 5 users, embeddings to match topics across users, and clarity from Buffer on using one user's data to inform another. A public count from Hacker News or Bluesky search is the smaller first step.
- Weekly digest; one idea → tailored drafts for several channels

**Out of scope:**

- Post analytics: not available to app clients **[Handbook]**
- Programmatic Google Trends data (links only)
- Media upload, so text-first channels only **[Handbook]**
- Creating Buffer tags
- YouTube transcripts
- Mobile, billing

**Supported posting channels:** LinkedIn, X, Threads, Bluesky, Mastodon, plus Substack if a text-only post works (§13). Other channels are shown disabled with a reason, because they need metadata or media. History is read from every channel for the fit check, even those we can't post to. Accounts with no supported channel can still save Ideas. The editor enforces per-channel character limits.

**Cut order if behind:**

1. Side panel's draft step, replaced by an "Open in website" link
2. Duplicate check against existing Ideas and queue
3. Extension reduced to capture-only

Joy moments aren't on this list. If time runs short, finish fewer moments well.

The website's capture → idea → post flow is never cut.

---

## 6. Architecture

```
Chrome extension (MV3)                Website (public URL)
 ├─ activeTab + scripting              ├─ OAuth login + callback
 ├─ side panel (capture → post)        ├─ inbox, capture, draft editor, settings
 └─ service worker ── bearer token ────┤
                                       ▼
                         Backend (Next.js on Vercel)
                          ├─ OAuth: PKCE, encrypted cookie, refresh locking
                          ├─ /analyze, /draft → Claude
                          ├─ /buffer/* → GraphQL proxy
                          └─ Neon Postgres: users, encrypted tokens, captures,
                             per-channel post cache, clusters, extension tokens
```

**Stack:** TypeScript, Next.js App Router on Vercel, Neon Postgres, own encrypted-cookie session (no auth library). Not Supabase: its free tier pauses inactive projects, which could break the app during judging.

**URL:** `scroll-spark.vercel.app` if available (not yet checked). Vercel preview URLs change per deployment and redirect URIs must match exactly, so OAuth only runs on localhost and the production URL.

**OAuth [Handbook + Docs]:**

- Authorize `GET https://auth.buffer.com/auth`; token `POST https://auth.buffer.com/token`
- Scopes: `account:read posts:read posts:write ideas:read ideas:write offline_access`
- Private (confidential) client with the secret on the server; PKCE S256 is still required
- Redirect URIs must be HTTPS, including localhost (`next dev --experimental-https`), and must match character for character
- State and verifier live in an encrypted **`SameSite=Lax`** cookie. `Strict` would drop it on the redirect back from Buffer.
- Token lifetime comes from `expires_in`. Tokens are encrypted at rest.

**Refresh safety:** refresh tokens are single-use, and reusing one revokes the whole grant. Each user's token row gets a short lock, so only one request refreshes and the others wait for the new token:

```sql
UPDATE buffer_grants SET refreshing_until = now() + interval '30 seconds'
WHERE user_id = $1 AND refreshing_until IS NULL AND needs_reconnect = false
RETURNING user_id;
```

Save the new token immediately and never retry a refresh automatically. If a refresh fails or its result is unclear, show a "Reconnect Buffer" button. An expired lock counts as unclear: that request may have spent the token before crashing, and reusing a spent token revokes the grant, so the user reconnects rather than risking it.

**Extension:**

- **Permissions:** `activeTab`, `scripting`, `sidePanel`, `contextMenus`, `storage`, with no host permissions. `activeTab` covers toolbar, context menu and keyboard shortcut, shows no install warning, and avoids the broad host access that slows review.
- **Sign-in:** the extension opens a tab on our website, which sends it a token through `externally_connectable`. The token is random, revocable, valid for 30 days, and stored only as a hash on our server. It never gives direct access to Buffer. The user can revoke it from website settings.
- **API access:** the API accepts only our extension's ID. A `key` in the manifest keeps one ID across unpacked and store versions.
- **UI:** a local React page in the side panel, with no iframe. Inbox and settings stay on the website.

## 7. Fit check

**[Handbook]** app clients can't read post metrics, so we claim **fit + freshness + demand**, never predicted success. Signals are shown separately, with no combined score.

| Signal              | Source                                               | Example output                                               |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| **Niche fit**       | Per-channel clusters and matching posts              | "Fits LinkedIn: AI tools (3 posts)" / "New for G(Old) Times" |
| **Freshness**       | Date of the last sent or scheduled post on the topic | "Last posted Sep 29"                                         |
| **Duplicate check** | Existing Buffer Ideas and queue                      | "You already have 2 ideas on this"                           |
| **Demand**          | Google Trends links                                  | The user decides                                             |

**Per channel, not per user:** one account can run very different channels, such as a software LinkedIn and a nostalgia YouTube channel, so an account-wide check would mislead.

**Clusters:** no fixed taxonomy. When the profile is built, each post gets a one-line summary and the LLM groups a channel's posts into 5–8 named clusters. At capture it receives those summaries and clusters, and returns the matching post IDs and a cluster, or a new cluster name. Our code validates every ID and calculates all counts and dates itself, so the numbers can't be hallucinated. The profile refreshes at most daily.

**History cleaning before analysis:**

- Ignore posts under about 80 characters
- Merge duplicate cross-posts
- Use only the first 500 characters of each post (YouTube descriptions can be mostly credits)
- No date cutoff, but always show the real date, so old posts can't pass as recent activity

**Empty state:** with fewer than 3 usable posts, say so and don't pretend to match the user's voice.

## 8. Google Trends links

```
https://trends.google.com/trends/explore?q=<phrase>&date=today%2012-m&geo=<country>
```

- Compare up to 5 phrases: `q=phrase1,phrase2,phrase3`
- `&gprop=youtube` when the source is YouTube
- `geo` defaults to `US`, changeable in settings
- Phrases are 1–3 common words, because very specific ones can come back empty
- Links are also written into the Buffer Idea text

## 9. Buffer API surface

Endpoint **[Handbook]:** `POST https://api.buffer.com`, `Authorization: Bearer <token>`, body `{"query": …, "variables": …}`.

| Purpose         | Operation                                    | Notes                                                                                                        |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Org picker      | `account { organizations }`                  | Cache. Also returns plan limits.                                                                             |
| Channel picker  | channels query                               | Cache; service per channel                                                                                   |
| Topic profile   | `posts` (`status` filter, `first`/`after`)   | Text only, no metrics; cache                                                                                 |
| Duplicate check | `ideas` (`organizationId`, optional filters) | Cache                                                                                                        |
| Save idea       | `createIdea`                                 | `organizationId` + `content` (`title`, `text`, `tags: []`). Topic goes in the text, like `Topic: AI agents`. |
| Ship post       | `createPost`                                 | Required: `channelId`, `assets`, `mode`, `needsApproval`, `schedulingType`. Also `ideaId`, `saveToDraft`.    |

**Tags:** never created. Tags are shared across the organization, and the API is an early preview that can change without notice. Docs say Free allows 3, though one real org showed a limit of 250.

**Plan limits:** organizations can have limits on scheduled posts and ideas (10 and 100 on the account checked). Show a clear message when one is reached.

**Rate limits: the sources disagree.**

| Window  | Handbook | Docs (app client)                |
| ------- | -------- | -------------------------------- |
| 15 min  | 100      | 100 + 10 per authorized user     |
| 24 h    | 250      | 500 + 25 per authorized user     |
| 30 days | 3,000    | 15,000 + 100 per authorized user |

App client limits are shared by all users, and the docs describe them as separate from plans, so paying probably won't raise them. `RateLimit-Policy` on the first real call shows the true quota.

**Quota protection (budget against the Handbook's numbers):**

- About 10 calls per judge session (estimate): 5 at sign-in, 2 per capture-to-post
- Read `RateLimit` headers. At 80% of quota, serve reads from cache only and keep the rest for writes.
- Honour `Retry-After` on 429s, with no loops
- Cap each user at 10 analyses a day, and hold the LLM account to prepaid credit with auto-reload off
- Separate dev client, so testing can't drain the judging client
- The real threat is our own testing or build-in-public traffic, not judges

## 10. AI

- **Model:** Claude Haiku 5.5 (`claude-haiku-5-5`) for both steps, with effort as the control: `low` for analysis, `medium` for drafts. See [ADR 0007](adr/0007-haiku-and-a-fixed-cap.md).
- **Cost:** about $0.002 per capture and draft (estimate, scaled from $0.06 on Opus 5.5 by the 40× price difference, at $0.10/$0.50 per million tokens). The owner's bill can't pass the prepaid credit, and users don't bring keys.
- **SDK:** official `@anthropic-ai/sdk` with `messages.parse()`. Handle `refusal` responses.
- **Safety:** captured text is untrusted data, and the model gets no tools. Output only reaches an editor the user reviews.

**`/analyze` output:**

```ts
{
  summary: string,
  topic: string,
  angle: string,
  trend_phrases: string[],   // 1–3 items, each 1–3 common words
  channels: [{
    channel_id: string,
    cluster_id: string | null,
    new_cluster_name: string | null,
    matching_post_ids: string[]
  }]
}
```

**Drafting rules:**

- Receives only the angle and a short summary, **never the source text**, so it can't act as a content spinner
- Source stored at no more than about 1,000 characters, with the source link kept on the Idea
- The editor warns if a draft closely overlaps the original
- Voice from up to 8 cleaned posts on the target channel
- Language defaults to that channel's most recent post, with a switch in the editor. Never bilingual unless asked. The interface stays in English.

## 11. Data and privacy

- **Stored:** captured excerpt (about 1,000 characters at most), URL, platform, AI output, org and channel IDs, encrypted tokens, cached post text, summaries and clusters, hashed extension tokens.
- **Not stored:** browsing history, or anything the user didn't explicitly capture.
- **Cross-user data:** none in the MVP.
- **Privacy page:** live by Mon Nov 9, because the store listing needs it. Includes how to disconnect and delete your data.

## 12. Staying live until Dec 7

- Daily job checks the database, makes one tiny AI call and one Buffer call, and emails on failure
- LLM account holds $5 of prepaid credit with auto-reload off. If it runs out, the daily job's AI call fails and sends the email, so top it up by hand
- After submitting, deploy only to fix something broken, so the app keeps matching the video

## 13. Test first

Run these in the Explorer or from the deployed app before relying on them:

- [ ] `RateLimit-Policy` values on the production client (Handbook vs. docs)
- [ ] Whether `createIdea` accepts an omitted `tags` field or needs `tags: []`
- [ ] How X and Threads handle the `thread` metadata field
- [ ] What `addToQueue` does on a channel with no posting slots
- [ ] Whether a text-only post works on Substack
- [ ] Bluesky search from Vercel's servers (stretch)
- [ ] LinkedIn extractor against the live page, with selected text as the fallback
- [ ] Opening the side panel while still getting `activeTab` access on a toolbar click

## 14. Risks

| Risk                                   | Impact                    | Mitigation                                                                                   |
| -------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| Extension not counted, or not accepted | Eligibility               | Website fully usable alone; ask on Discord today                                             |
| Chrome review takes days or weeks      | Extension not installable | Capture-only version submitted by Tue noon; store link and GitHub zip both in the submission |
| Refresh-token reuse                    | User disconnected         | Row lock, immediate save, no automatic retry                                                 |
| OAuth state lost on serverless         | Login broken              | Encrypted `SameSite=Lax` cookie                                                              |
| LinkedIn markup changes                | Capture breaks            | Small extractor, selected-text fallback, editable review step                                |
| Thin history for a user or demo        | Weak fit check            | Honest empty state; real build-in-public posts on the demo account                           |
| Outage during judging                  | Eligibility               | Daily health check, prepaid LLM credit, deploy freeze                                        |
| Submission is final                    | Can't fix later           | Submit a polished build, not a draft                                                         |

## 15. Timeline

| Day        | Goal                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fri 6**  | Name locked. Create app clients (prod + dev). Run Explorer tests. Ask Discord about the extension. Register store developer account. Scaffold and deploy. OAuth end to end, first real API call. |
| **Sat 7**  | Website capture (text, URL enrichment) + `/analyze` + Trends links                                                                                                                               |
| **Sun 8**  | Create Idea + `createPost` + draft editor                                                                                                                                                        |
| **Mon 9**  | Topic profile, clusters, fit check, inbox. **Privacy page live.** Website flow complete.                                                                                                         |
| **Tue 10** | Extension. **Submit working capture-only version by noon.** Side panel.                                                                                                                          |
| **Wed 11** | Full extension submitted by night. Bug bash with a second Buffer account. **5–6 build-in-public posts published by today.**                                                                      |
| **Thu 12** | Morning: joy pass on motion and polish, rate-limit hardening. Afternoon: 2-minute video and 300-word summary.                                                                                    |
| **Fri 13** | Final checks. Submit well before 11:59 p.m. PT.                                                                                                                                                  |

## 16. Demo video

Recorded Thursday on the real LinkedIn account. The fit-per-channel moment gets the most time, because judges won't have seen it before.

| Time      | What the video shows                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| 0:00–0:10 | Scrolling LinkedIn, and a good idea is about to be lost                                          |
| 0:10–0:25 | Press the shortcut, and the panel opens with the post                                            |
| 0:25–0:50 | Topic, angle, fit per channel, then open Google Trends                                           |
| 0:50–1:05 | Save it, then show it in Buffer Ideas, labelled `createIdea`                                     |
| 1:05–1:30 | Draft in your voice, edit, queue it, then show it in Buffer, labelled `createPost` with `ideaId` |
| 1:30–1:50 | The same flow on the website, with no install                                                    |
| 1:50–2:00 | What comes next                                                                                  |

**Demo history:** 5–6 real build-in-public posts on LinkedIn by Nov 11, mentioning Buffer Commit. They give the fit check real data, supply voice examples, and count towards the Build-in-Public Award.

## 17. Name and identity

**Scroll Spark.** A quick search found no product with that name, only an unrelated JavaScript library called `spark-scroll`. Domains and trademarks weren't checked. Simple spark icon, with no Buffer logo or Buffer-like styling.

**Look:** Riso Print, chosen from three directions. UI and joyful animation are a main focus, because Buffer is for creators. See [design-system.md](design-system.md), the [design canvas](https://claude.ai/artifact/EAAmg5cCVLGi24JhtKxJGc) and the published [design system](https://claude.ai/artifact/VPTL726rTzSYqdkXPLGbPL). Both links are private until the owner shares them.

**Marketing video (optional):** the [motion-graphics skills](https://github.com/Barty-Bart/motion-graphics) can make a landing page loop or teaser. The 2-minute demo stays a real screen recording, because the handbook requires the real product.

**Repo:** `bernardosevero/scroll-spark`, public.

## 18. Submission checklist

- [ ] Client ID of the production app client (not the secret)
- [ ] Contact info (solo: you are the team captain)
- [ ] Website live at a public URL through judging (Nov 16 → Dec 7)
- [ ] A fresh Buffer account can sign in and complete capture → idea → draft or queued post
- [ ] 2-minute public demo video showing the real app and where the Buffer API is used
- [ ] 300-word summary: idea origin, problem, what comes next (cross-creator count)
- [ ] Extension store link and GitHub zip
- [ ] Build-in-public posts mentioning Buffer Commit
- [ ] Deployed version matches the video
