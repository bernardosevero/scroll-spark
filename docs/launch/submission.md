# Contest submission drafts

Drafts for the owner to change and send. **Submissions can't be changed once sent**, and only the owner submits. The deadline is Nov 13, 2026, 11:59 p.m. PT.

Anything in `[brackets]` is the owner's to fill in, because only the owner knows it. Check every claim against what actually works on the day, and cut anything that doesn't.

## 300-word summary

About 220 words as written, which leaves room for your own origin story.

> **The idea.** [One or two sentences in your own words: when you noticed you kept losing ideas while scrolling, and what you were trying to post at the time.]
>
> **The problem.** Inspiration shows up while you scroll, then gets lost. Even when you save it, there's no quick way to judge whether it's worth posting, and turning it into a post means switching apps. It's harder with several channels, because a topic that belongs on your LinkedIn may have no place on your other account.
>
> **What it does.** Scroll Spark captures a post while you scroll, from the website or a Chrome side panel. It suggests an angle you could take, then checks the topic against what each channel has already posted, with real counts and dates: "Fits LinkedIn: AI tools, 3 posts, last posted Sep 29." It links Google Trends so you can judge demand yourself.
>
> **Where Buffer comes in.** The Buffer API powers the core: Scroll Spark reads your channels and post history, saves captures with `createIdea`, and ships them with `createPost`, keeping the link between idea and post. "Save as draft" is the main button, because a queued post may publish for real.
>
> **What's next.** "Other creators are talking about this", counted across users with a privacy threshold, a weekly digest, and tailored drafts for several channels from one idea.

## Form fields

- **App client ID:** `f4OQVSnb3UQ56rP-5Vo4aTllNarOomN4x6dZsX8l2nZ`. It's meant to be public. Never send the secret.
- **Team:** `[your name and contact. Solo, so you're team captain.]`
- **App URL:** `https://scroll-spark-app.vercel.app`
- **Video:** `[public link]`
- **Extension:** `[store link]`, plus the GitHub release zip
- **Build-in-public posts:** `[links]`

## Demo video, under 2 minutes

The shot list is in [PROJECT_DEFINITION.md](../PROJECT_DEFINITION.md), section 16. The rules: real product, no slides, and show where the Buffer API is used.

Before recording:

- [ ] Your channels have 5 or 6 real posts, so the fit check has something to show
- [ ] You've watched the five joy moments, since the fit reveal gets the most screen time
- [ ] The whole flow has worked on production that day
- [ ] Use "Save as draft" unless you really want the queued post to publish

## Build-in-public posts

Due by Wed Nov 11, 5 or 6 of them, each mentioning Buffer Commit. They also become the demo's voice samples and fit history, so **rewrite them in your own words**, and post only what's true when you post it.

They need to run 80 characters or more to count as history.

**1. Starting**

> I keep losing post ideas while scrolling. I see something good, think "I should write about that", and it's gone. So for #BufferCommit I'm building Scroll Spark: capture a post you like, see how it fits your channels, and turn it into your own. [What made you start.]

**2. A decision that cost something**

> Scroll Spark won't predict how a post will do. Buffer's API doesn't give app clients metrics, and I'd rather not fake it. So it shows counts and dates instead: "3 posts on this, last on Sep 29". You decide. Building this for #BufferCommit.

**3. Originality**

> One rule I set early for my #BufferCommit project: when the AI drafts your post, it never sees the original's text. Only the angle and a summary. Otherwise it's a content spinner, and nobody needs another one of those.

**4. Channels**

> One account can run very different channels, so "does this fit my account?" is the wrong question. Scroll Spark checks each channel on its own: fits here, new there. It's what I wanted most when planning posts. #BufferCommit

**5. Craft**

> Buffer is for creators, so I spent real time on how my #BufferCommit project feels. Cream paper, navy ink, pink overprint, and small moments of joy: a stack of your matching posts fans out when a topic fits. [Screen recording.]

**6. Shipping**

> Scroll Spark is live for #BufferCommit: capture a post while you scroll, see how it fits each channel, and ship it through Buffer. Try it at https://scroll-spark-app.vercel.app. Built on the Buffer API. What would make you use it?
