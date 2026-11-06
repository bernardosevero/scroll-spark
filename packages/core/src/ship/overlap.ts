const SHINGLE_WORDS = 4;
/** A draft is close when this share of its words sit inside phrases copied from the source. */
const CLOSE_SHARE = 0.3;
/** Or when it copies one run of this many words in a row. */
const CLOSE_RUN = 10;

export interface Overlap {
  isClose: boolean;
  /** The share of the draft's words that sit inside phrases also found in the source, 0 to 1. */
  share: number;
}

function wordsOf(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Compares a draft with the text it came from, locally and without a model. It finds phrases of
 * four words or more that appear in both.
 */
export function findOverlap(draft: string, source: string): Overlap {
  const draftWords = wordsOf(draft);
  const sourceWords = wordsOf(source);

  if (draftWords.length < SHINGLE_WORDS || sourceWords.length < SHINGLE_WORDS) {
    return { isClose: false, share: 0 };
  }

  const sourcePhrases = new Set<string>();

  for (let start = 0; start + SHINGLE_WORDS <= sourceWords.length; start += 1) {
    sourcePhrases.add(sourceWords.slice(start, start + SHINGLE_WORDS).join(" "));
  }

  const isCopied = draftWords.map(() => false);

  for (let start = 0; start + SHINGLE_WORDS <= draftWords.length; start += 1) {
    if (sourcePhrases.has(draftWords.slice(start, start + SHINGLE_WORDS).join(" "))) {
      for (let offset = 0; offset < SHINGLE_WORDS; offset += 1) {
        isCopied[start + offset] = true;
      }
    }
  }

  let copied = 0;
  let run = 0;
  let longestRun = 0;

  for (const isWordCopied of isCopied) {
    run = isWordCopied ? run + 1 : 0;
    copied += isWordCopied ? 1 : 0;
    longestRun = Math.max(longestRun, run);
  }

  const share = copied / draftWords.length;

  return { isClose: share >= CLOSE_SHARE || longestRun >= CLOSE_RUN, share };
}
