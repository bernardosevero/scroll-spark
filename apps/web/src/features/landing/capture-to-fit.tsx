import { Card } from "@scroll-spark/ui/card";
import { FitRow } from "@scroll-spark/ui/fit-row";
import { Reveal } from "@scroll-spark/ui/reveal";

const LABEL =
  "w-fit rounded-full border-2 border-navy bg-cream px-3 py-0.5 text-sm font-bold text-navy";

/** A made-up example of the whole trip, built from the real components. */
export function CaptureToFit() {
  return (
    <Reveal>
      <figure
        aria-label="An example: a captured post, how it fits two channels, and an angle for it"
        className="relative flex flex-col gap-5 py-2 pr-2 sm:pr-4"
      >
        <Card className="flex -rotate-1 flex-col gap-3 bg-stone">
          <span className={LABEL}>1. Captured while scrolling</span>
          <p className="font-medium">
            &ldquo;Small fixes can matter more than big features. One tiny change cut our support
            emails in half.&rdquo;
          </p>
        </Card>

        <Card isFeatured className="flex rotate-1 flex-col gap-3">
          <span className={LABEL}>2. How it fits your channels</span>
          <FitRow channel="LinkedIn" verdict="fits" detail="2 posts, last on Sep 29" />
          <FitRow channel="Newsletter" verdict="new" detail="No posts on this yet" />
        </Card>

        <Card className="flex -rotate-1 flex-col gap-3">
          <span className={LABEL}>3. Your angle</span>
          <p className="font-display text-2xl leading-tight font-extrabold">
            The quiet customer who changed what you built
          </p>
        </Card>
      </figure>
    </Reveal>
  );
}
