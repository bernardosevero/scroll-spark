import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { Reveal } from "@scroll-spark/ui/reveal";
import { SparkMark } from "@scroll-spark/ui/spark-mark";

export interface Sent {
  kind: "draft" | "queue";
  /** The channel's name, as the user knows it. */
  channelTitle: string;
  /** The service's name, such as "LinkedIn". */
  serviceLabel: string;
}

/** Stage 6. Says what reached Buffer, in words, and offers the next capture. */
export function DoneStage({
  sent,
  captureId,
  webOrigin,
  onFinish,
}: {
  sent: Sent;
  captureId: string;
  webOrigin: string;
  onFinish: () => void;
}) {
  return (
    <Reveal>
      <Card isFeatured className="flex flex-col items-stretch gap-4 p-4!">
        <h2 className="flex items-center gap-2 font-display text-2xl leading-7 font-extrabold tracking-tight">
          <SparkMark size={22} />
          {sent.kind === "draft" ? "Draft saved" : "Added to the queue"}
        </h2>
        <p role="status" className="font-medium">
          {sent.kind === "draft"
            ? `Saved as a draft in Buffer for ${sent.channelTitle}.`
            : `Added to the ${sent.serviceLabel} queue in Buffer for ${sent.channelTitle}.`}
        </p>
        <Button onClick={onFinish}>Capture another</Button>
        <ButtonLink
          href={`${webOrigin}/inbox/${captureId}`}
          target="_blank"
          rel="noreferrer"
          variant="plain"
        >
          Open in your inbox
        </ButtonLink>
      </Card>
    </Reveal>
  );
}
