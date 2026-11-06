import { Card } from "./card";
import { Reveal } from "./reveal";

export type PingCardProps =
  { status: "loading" } | { status: "error" } | { status: "ready"; message: string };

/** Shared by the website and the side panel, to prove both run the same UI against the same API. */
export function PingCard(props: PingCardProps) {
  return (
    <Card isFeatured role="status" className="font-medium">
      {props.status === "loading" && <p>Looking for a spark…</p>}
      {props.status === "error" && <p className="text-danger">The API didn&apos;t answer.</p>}
      {props.status === "ready" && (
        <Reveal>
          <p>{props.message}</p>
        </Reveal>
      )}
    </Card>
  );
}
