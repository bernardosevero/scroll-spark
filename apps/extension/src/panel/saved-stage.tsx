import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { Reveal } from "@scroll-spark/ui/reveal";
import { SparkMark } from "@scroll-spark/ui/spark-mark";

/** Stage 4. The idea is in Buffer Ideas. Next is a draft, or another capture. */
export function SavedStage({
  captureId,
  webOrigin,
  onDraft,
  onFinish,
}: {
  captureId: string;
  webOrigin: string;
  onDraft: () => void;
  onFinish: () => void;
}) {
  return (
    <Reveal>
      <Card isFeatured className="flex flex-col items-stretch gap-4 p-4!">
        <h2 className="flex items-center gap-2 font-display text-2xl leading-7 font-extrabold tracking-tight">
          <SparkMark size={22} />
          Saved to Buffer Ideas
        </h2>
        <p className="font-medium">It&apos;s in your inbox on the website too.</p>
        <Button onClick={onDraft}>Draft a post</Button>
        <ButtonLink
          href={`${webOrigin}/inbox/${captureId}`}
          target="_blank"
          rel="noreferrer"
          variant="plain"
        >
          Open in your inbox
        </ButtonLink>
        <Button variant="plain" onClick={onFinish}>
          Capture another
        </Button>
      </Card>
    </Reveal>
  );
}
