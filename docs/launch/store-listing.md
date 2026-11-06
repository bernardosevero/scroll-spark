# Chrome Web Store listing

Draft text for the owner to paste. The capture-only deadline is **Tue Nov 10, noon**, because review can take days.

**Check first, in real Chrome:** toolbar, right-click and shortcut on live LinkedIn and YouTube, plus sign-in and revoke. None of it has run in a real browser yet. Don't submit until it has.

## Package

Build with the production origin. See [../deploy.md](../deploy.md), step 5. Icons are in `apps/extension/public/icon/`.

## Store listing tab

**Name:** Scroll Spark

**Short description (132 characters at most):**

> Capture a post you like while scrolling, see how it fits your channels, and turn it into your next post.

**Category:** Productivity, under Workflow & Planning if offered

**Language:** English

**Detailed description:**

> Good ideas show up while you scroll, then get lost. Scroll Spark keeps them.
>
> Press the shortcut, right-click, or click the toolbar icon on a post you like. The side panel opens with its text, ready for you to correct. Then:
>
> - See the topic, and an angle you could take from your own experience
> - See how it fits each of your channels, with real post counts and dates
> - Open Google Trends for the phrases behind it
> - Save it as a Buffer Idea, and draft a post in your channel's voice
>
> Nothing is written to Buffer until you ask. Drafts are written from the angle and a summary, never the original post's text.
>
> Works with a free Scroll Spark website account, which you connect with your Buffer account. Built on the Buffer API. Not made by or affiliated with Buffer.
>
> The extension only reads a page after you ask it to. It doesn't watch your browsing.

**Screenshots (1280×800, at least one):** take these from the real extension in Chrome, with a real or demo account:

1. A post on the page, with the panel open on its captured text
2. The analysis card, with fit rows showing counts and dates
3. The draft editor, with "Save as draft" and the queue button

**Website:** `https://<production-domain>`

## Privacy tab

**Single purpose:**

> Capture a post the user chooses on the current page, so they can analyze it and turn it into a post of their own on the Scroll Spark website and through Buffer.

**Permission justifications:**

| Permission     | Why                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `activeTab`    | Reads the current tab only after the user clicks the icon, presses the shortcut or uses the right-click item.   |
| `scripting`    | Runs the one capture script in that tab, after that same action, to read the selected text or the post in view. |
| `sidePanel`    | Shows the captured text for correction, and the analysis and draft, beside the page.                            |
| `contextMenus` | Adds the "Capture with Scroll Spark" right-click item.                                                          |
| `storage`      | Keeps the sign-in token, and the capture waiting for the panel, on the user's device.                           |

**Remote code:** No. Everything ships in the package.

**Host permissions:** None.

**Data usage:** tick what applies. Check this against the form's current wording.

- **Website content:** collected. It's the text the user chooses to capture.
- **Authentication information:** collected. It's the sign-in token for Scroll Spark, stored as a hash on the server.
- Certify that data isn't sold, isn't used for unrelated purposes, and isn't used for creditworthiness or lending.

**Privacy policy URL:** `https://<production-domain>/privacy`, which must be live first.

## Notes for the reviewer

> Sign in needs a Buffer account. To test: open the panel, choose to connect, sign in on the website, then select text on any page and click the toolbar icon. The panel shows the text for correction.
>
> The extension makes no background requests about browsing. It only reads a page after one of those three user actions.

If the review needs a test account, create one for them. Don't share your own.
