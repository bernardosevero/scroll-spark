import type { ReactNode } from "react";

import { Card } from "./card";
import { SparkWait } from "./spark-wait";

export type AnalysisCardProps = (
  | {
      status: "ready";
      topic: string;
      angle: string;
      summary: string;
      /** The angle is the screen's heading. Lower it to 2 where the page already has a title. */
      headingLevel?: 1 | 2;
    }
  | { status: "finding" }
  | { status: "failed"; message: string; children?: ReactNode }
) & { className?: string };

/** What the AI found in a capture: its topic, an angle for this user, and a summary. */
export function AnalysisCard(props: AnalysisCardProps) {
  const { className = "" } = props;
  if (props.status === "finding") {
    return (
      <Card isFeatured className={`flex flex-col items-start gap-4 ${className}`}>
        <SparkWait
          steps={[
            { label: "Saved to your inbox", isDone: true },
            { label: "Finding the spark…", isDone: false },
          ]}
        />
      </Card>
    );
  }

  if (props.status === "failed") {
    return (
      <Card isFeatured className={`flex flex-col items-start gap-4 ${className}`}>
        <p role="alert" className="font-medium text-danger">
          {props.message}
        </p>
        {props.children}
      </Card>
    );
  }

  const { topic, angle, summary, headingLevel = 1 } = props;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <Card isFeatured className={`flex flex-col gap-4 ${className}`}>
      <p className="text-sm font-bold">{topic}</p>
      <Heading className="font-display text-4xl leading-10 font-extrabold tracking-tight">
        {angle}
      </Heading>
      <p>{summary}</p>
    </Card>
  );
}
