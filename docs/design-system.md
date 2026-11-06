# Riso Print design system

Scroll Spark should feel like a small print studio: cream paper, navy ink, pink overprint, hard shadows. It's made for creators, so it should spark joy without getting in their way.

**Where it lives:** tokens in `packages/ui/src/tokens.css`, components in `packages/ui/src/`, live specimens at `/system`. Those are the source of truth. If this file disagrees with them, the code wins, and this file gets fixed.

## Colour

Values are sampled from the owner's Pantone swatches, so they're approximate. `spark` is P 73-7 C darkened slightly to pass with white text.

| Token    | Hex       | Pantone   | Role                                               |
| -------- | --------- | --------- | -------------------------------------------------- |
| `cream`  | `#FCEEAF` | 938 C     | Page background                                    |
| `stone`  | `#D8D7CA` | P 3-9 C   | Quiet surfaces, finished items, disabled           |
| `paper`  | `#FFFFFF` |           | Cards and fields                                   |
| `navy`   | `#2C3A67` | P 105-8 C | All text, outlines, secondary shadow               |
| `spark`  | `#C4467B` | P 73-7 C  | The one main action, celebrations, featured shadow |
| `blue`   | `#2D4C8F` | P 104-8 C | Links, focus rings                                 |
| `danger` | `#C43D3A` | P 48-8 C  | Errors and "Reconnect Buffer" only                 |

**Pairs that pass for small text (4.5:1):** navy on cream, stone or paper; white on navy, blue, danger or spark.

**Large text only (24px and up, 3:1):** spark or danger on cream.

**Never let these carry meaning side by side:** spark with danger (1.2:1), navy with blue (1.3:1). Use a label, not colour alone.

Buffer's own product leans on blue, and contest rules forbid looking like Buffer, so blue stays a supporting colour.

## Type

| Family                   | Use                                             |
| ------------------------ | ----------------------------------------------- |
| Bricolage Grotesque, 800 | Headings and angles. Big, tight, a little loud. |
| DM Sans, 400 to 700      | Everything people read or act on.               |

Both ship inside the app with Fontsource, so the extension loads nothing remote.

## Shape and depth

- Corners are `rounded-print` (6px). Only chips are fully round.
- Outlines are 3px navy. Chips use 2px.
- Shadows are hard offsets with no blur. `shadow-offset-spark` marks the one card a screen is about. `shadow-offset-navy` is for buttons.
- Halftone dots sit on the page background, never behind running text on a card.
- Touch targets are at least 44px.

## Motion

Motion is a main part of the product's joy, so it gets real design time.

| Rule                 | Value                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| Everyday transitions | Under 300 ms (`DURATION.everyday`)                                                 |
| Celebrations         | Under 800 ms (`DURATION.celebration`)                                              |
| Feel                 | A soft overshoot (`EASE_SPARK`), like something landing on a page                  |
| Input                | Animation never blocks clicking or typing                                          |
| Reduced motion       | `prefers-reduced-motion` is always respected. The words must carry the news alone. |

Use `motion` for choreography and CSS transitions for hover and press. Animate `transform` and `opacity`, so it stays smooth.

### The five moments

These get the effort. Everything else stays calm.

1. **Capture:** the post lifts off the page into the panel with a small spark.
2. **Waiting for AI:** a turning spark and steps that tick off, showing real progress.
3. **Fit reveal:** matching posts fan out and the count ticks up. This is the signature moment.
4. **Save idea:** the card flies into the Ideas pile.
5. **Queued:** a short burst of sparks.

The prototype of all five is on the [design canvas](https://claude.ai/artifact/EAAmg5cCVLGi24JhtKxJGc). It's private until the owner shares it.

## Voice

Warm and short, in plain words, like a friend pointing at something good. "This one has a spark." "Sounds like you?" Name what happens: "Save as draft", then "Saved to Buffer Ideas". Fit copy states counts and dates, and never predicts success.
