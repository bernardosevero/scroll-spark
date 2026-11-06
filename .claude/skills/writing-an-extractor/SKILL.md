---
name: writing-an-extractor
description: Add or fix page capture in the extension. Use for LinkedIn or YouTube capture, selected text, keyboard shortcut, right-click menu, or extension permissions.
---

# Writing an extractor

The extension only reads a page after the user acts, through `activeTab`.

1. **Save real HTML** from the page as a fixture, with personal details removed.
2. **Go red.** Test the extractor as a pure function from a document to `{ text, author, url, platform }`, using the fixture.
3. **Order of capture:** selected text first, then the post nearest the middle of the screen, then page title and URL.
4. **Stay small.** Markup changes without warning. Prefer stable attributes over generated class names, and return nothing rather than guessing.
5. **Check in a real browser.** Done when capture works on the live page and a failed capture asks the user to select the text.

## Rules

- Add a manifest permission only with the code that uses it, because store review checks them. The agreed set is `activeTab`, `scripting`, `sidePanel`, `contextMenus` and `storage`, with no host permissions.
- Read nothing in the background, and no native "like" hooks.
- The panel always shows captured text for correction before any AI runs.
- Store at most about 1,000 characters of source text.
- YouTube captures use title and description, with no transcripts.
