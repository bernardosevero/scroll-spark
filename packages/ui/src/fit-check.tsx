import { useId } from "react";
import type { ReactNode } from "react";

import { FitReveal } from "./fit-reveal";
import { FitRow } from "./fit-row";
import type { FitRowProps } from "./fit-row";

export interface FitCheckProps {
  /** One row per channel, already worded. Empty when no fit check ran. */
  rows: (FitRowProps & {
    /** How many of the channel's posts match, so the reveal can fan them out and count them. */
    matchCount: number;
  })[];
  /** Ideas and queued posts that already cover this, in words. Null means nothing to say. */
  duplicateNote: string | null;
  /** Shown when there are no rows, such as a link to choose channels. */
  emptyAction?: ReactNode;
}

/** How the capture relates to each channel: counts and dates, never a prediction. */
export function FitCheck({ rows, duplicateNote, emptyAction }: FitCheckProps) {
  const titleId = useId();
  const title = (
    <h2 id={titleId} className="font-display text-2xl font-extrabold">
      How it fits your channels
    </h2>
  );

  if (rows.length === 0) {
    return (
      <section aria-labelledby={titleId} className="flex flex-col items-start gap-2">
        {title}
        <p>There&apos;s no fit check for this one yet.</p>
        {emptyAction}
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      {title}
      <ul className="flex flex-col gap-3">
        {rows.map(({ matchCount, ...row }, index) => (
          <li key={row.channel}>
            <FitReveal matchCount={matchCount} index={index}>
              <FitRow {...row} />
            </FitReveal>
          </li>
        ))}
      </ul>
      {duplicateNote !== null && <p className="font-medium">{duplicateNote}</p>}
    </section>
  );
}
