import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { appCodeOf } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { AnalysisCard } from "@scroll-spark/ui/analysis-card";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { analysisFailureMessage } from "@scroll-spark/ui/ship-messages";

import type { PendingCapture } from "../capture/pending-capture";
import { AnalysisStage } from "./analysis-stage";
import { DoneStage } from "./done-stage";
import type { Sent } from "./done-stage";
import { DraftStage } from "./draft-stage";
import { Failure } from "./failure";
import { ReviewForm } from "./review-form";
import { startOf } from "./review-start";
import { SavedStage } from "./saved-stage";

type Stage = "analysis" | "saved" | "draft";

/** Stage 2. The wait while the capture is saved and read. Plain words until the animation lands. */
function Finding() {
  return (
    <div className="flex flex-col gap-4">
      <AnalysisCard status="finding" className="p-4!" />
      <p className="font-medium">Reading your capture, then checking it against your channels.</p>
    </div>
  );
}

/** The capture is saved, but the analysis didn't come back. Its text stays on screen. */
function AnalysisFailed({
  code,
  text,
  captureId,
  isPending,
  webOrigin,
  connectUrl,
  onTryAgain,
}: {
  code: string | null;
  text: string;
  captureId: string;
  isPending: boolean;
  webOrigin: string;
  connectUrl: string;
  onTryAgain: () => void;
}) {
  return (
    <Card isFeatured className="flex flex-col items-start gap-4 p-4!">
      <Failure
        code={code}
        message={analysisFailureMessage(code)}
        webOrigin={webOrigin}
        connectUrl={connectUrl}
      />
      <p className="text-sm font-bold">What you captured</p>
      <p className="wrap-anywhere whitespace-pre-line">{text}</p>
      {code !== "ANALYSIS_LIMIT_REACHED" && code !== "NOT_SIGNED_IN" && (
        <Button disabled={isPending} onClick={onTryAgain}>
          Try again
        </Button>
      )}
      <ButtonLink
        href={`${webOrigin}/inbox/${captureId}`}
        target="_blank"
        rel="noreferrer"
        variant="plain"
      >
        Open in your inbox
      </ButtonLink>
    </Card>
  );
}

/**
 * One capture's trip through the panel: review, wait, analysis, saved, draft, done. It only shows
 * what the API answered. Every rule behind it lives in the services the website uses too.
 */
export function CaptureFlow({
  pending,
  webOrigin,
  connectUrl,
  onFinish,
}: {
  pending: PendingCapture;
  webOrigin: string;
  connectUrl: string;
  onFinish: () => void;
}) {
  const trpc = useTRPC();
  const start = startOf(pending);
  const [text, setText] = useState(start.text);
  const [source, setSource] = useState(start.source);
  const [stage, setStage] = useState<Stage>("analysis");
  const [sent, setSent] = useState<Sent | null>(null);
  const create = useMutation(trpc.capture.create.mutationOptions());
  const analyze = useMutation(trpc.capture.analyze.mutationOptions());
  const { mutate: analyzeCapture } = analyze;

  const savedCapture = create.data;
  const links = { webOrigin, connectUrl };

  function find() {
    create.mutate(
      {
        text,
        sourceUrl: source?.url ?? null,
        platform: source?.platform ?? "pasted",
        sourceName: source?.name ?? null,
      },
      {
        onSuccess: ({ id }) => {
          analyzeCapture({ captureId: id });
        },
      },
    );
  }

  if (savedCapture !== undefined && sent !== null) {
    return (
      <DoneStage
        sent={sent}
        captureId={savedCapture.id}
        webOrigin={webOrigin}
        onFinish={onFinish}
      />
    );
  }

  if (create.isPending || analyze.isPending || (create.isSuccess && analyze.isIdle)) {
    return <Finding />;
  }

  if (savedCapture === undefined) {
    const code = appCodeOf(create.error);

    return (
      <ReviewForm
        text={text}
        onTextChange={setText}
        source={source}
        onRemoveSource={() => {
          setSource(null);
        }}
        notice={start.notice}
        error={
          create.isError && (
            <Failure
              code={code}
              message="That didn't save. Your text is still here, so you can try again."
              webOrigin={webOrigin}
              connectUrl={connectUrl}
            />
          )
        }
        onFind={find}
      />
    );
  }

  if (!analyze.isSuccess || analyze.data.analysis === null) {
    return (
      <AnalysisFailed
        code={appCodeOf(analyze.error)}
        text={savedCapture.text}
        captureId={savedCapture.id}
        isPending={analyze.isPending}
        webOrigin={webOrigin}
        connectUrl={connectUrl}
        onTryAgain={() => {
          analyzeCapture({ captureId: savedCapture.id });
        }}
      />
    );
  }

  if (stage === "saved") {
    return (
      <SavedStage
        captureId={savedCapture.id}
        webOrigin={webOrigin}
        onDraft={() => {
          setStage("draft");
        }}
        onFinish={onFinish}
      />
    );
  }

  if (stage === "draft") {
    return (
      <DraftStage
        captureId={savedCapture.id}
        sourceText={savedCapture.text}
        links={links}
        onSent={setSent}
      />
    );
  }

  return (
    <AnalysisStage
      first={analyze.data}
      webOrigin={webOrigin}
      connectUrl={connectUrl}
      onSaved={() => {
        setStage("saved");
      }}
      onDraft={() => {
        setStage("draft");
      }}
    />
  );
}
