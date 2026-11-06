"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { appCodeOf, describeChannelFit, describeDuplicates } from "@scroll-spark/api/client";
import type { CapturedAnalysis } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { AnalysisCard } from "@scroll-spark/ui/analysis-card";
import { Card } from "@scroll-spark/ui/card";
import { FitCheck } from "@scroll-spark/ui/fit-check";
import { Reveal } from "@scroll-spark/ui/reveal";
import { analysisFailureMessage } from "@scroll-spark/ui/ship-messages";
import { TrendsLinks } from "@scroll-spark/ui/trends-links";

import { SessionOver } from "../capture/session-over";
import { ShipPanel } from "../ship/ship-panel";
import { AppFrame } from "../shell/app-frame";

function useCapturedAnalysis(captureId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.capture.get.queryOptions({ captureId }));
  const analyze = useMutation(
    trpc.capture.analyze.mutationOptions({
      onSuccess(result) {
        queryClient.setQueryData(trpc.capture.get.queryKey({ captureId }), result);
      },
    }),
  );

  return { query, analyze };
}

type Analysis = NonNullable<CapturedAnalysis["analysis"]>;

function FitCheckSection({ analysis }: { analysis: Analysis }) {
  const { channels, duplicates } = analysis;
  const now = new Date();

  return (
    <FitCheck
      rows={(channels ?? []).map((fit) => ({
        ...describeChannelFit(fit, { now }),
        matchCount: fit.state === "fits" ? fit.matchingPosts : 0,
      }))}
      duplicateNote={duplicates === null ? null : describeDuplicates(duplicates)}
      emptyAction={
        <ButtonLink href="/channels" variant="plain">
          Choose your channels
        </ButtonLink>
      }
    />
  );
}

function TrendsSection({ captureId, data }: { captureId: string; data: CapturedAnalysis }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setGeo = useMutation(
    trpc.settings.setTrendsGeo.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.capture.get.queryFilter({ captureId })),
    }),
  );
  const trends = data.analysis?.trends;

  return (
    <TrendsLinks
      links={trends?.links ?? []}
      compareUrl={trends?.compareUrl ?? null}
      geo={data.trendsGeo}
      isSaving={setGeo.isPending}
      hasError={setGeo.isError}
      onGeoChange={(geo) => {
        setGeo.mutate({ geo });
      }}
    />
  );
}

function SourceText({ data }: { data: CapturedAnalysis }) {
  const { text, sourceUrl } = data.capture;

  return (
    <section
      aria-labelledby="source-title"
      className="flex flex-col gap-2 rounded-print border-[3px] border-navy bg-paper p-6"
    >
      <h2 id="source-title" className="text-sm font-bold">
        What you captured
      </h2>
      <p className="wrap-anywhere whitespace-pre-line">{text}</p>
      {sourceUrl !== null && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex min-h-11 items-center self-start font-medium wrap-anywhere text-blue underline"
        >
          Open the source
        </a>
      )}
    </section>
  );
}

function AnalysisContent({
  captureId,
  shouldAnalyze,
}: {
  captureId: string;
  shouldAnalyze: boolean;
}) {
  const { query, analyze } = useCapturedAnalysis(captureId);
  const { data, error, isPending, refetch, isFetching } = query;
  const { mutate } = analyze;
  const hasStarted = useRef(false);
  const isWaitingToAnalyze = shouldAnalyze && data !== undefined && data.analysis === null;

  useEffect(() => {
    if (isWaitingToAnalyze && !hasStarted.current) {
      hasStarted.current = true;
      mutate({ captureId });
    }
  }, [captureId, isWaitingToAnalyze, mutate]);

  if (isPending) {
    return <p role="status">Opening this capture…</p>;
  }

  if (error !== null) {
    const code = appCodeOf(error);

    if (code === "NOT_SIGNED_IN") {
      return <SessionOver />;
    }

    if (code === "NOT_FOUND" || error.data?.code === "BAD_REQUEST") {
      return <p className="font-medium">We can&apos;t find that capture.</p>;
    }

    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-medium">We couldn&apos;t open this capture.</p>
        <Button
          variant="plain"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const { analysis } = data;

  if (analysis !== null) {
    return (
      <Reveal>
        <div className="flex flex-col gap-8">
          <AnalysisCard
            status="ready"
            topic={analysis.topic}
            angle={analysis.angle}
            summary={analysis.summary}
          />
          <FitCheckSection analysis={analysis} />
          <TrendsSection captureId={captureId} data={data} />
          <ShipPanel captureId={captureId} sourceText={data.capture.text} />
          <SourceText data={data} />
        </div>
      </Reveal>
    );
  }

  const code = appCodeOf(analyze.error);
  const canTryAgain = code !== "ANALYSIS_LIMIT_REACHED" && code !== "NOT_SIGNED_IN";

  return (
    <div className="flex flex-col gap-8">
      {analyze.isPending ? (
        <AnalysisCard status="finding" />
      ) : code === "NOT_SIGNED_IN" ? (
        <Card isFeatured>
          <SessionOver />
        </Card>
      ) : analyze.isError ? (
        <AnalysisCard status="failed" message={analysisFailureMessage(code)}>
          {canTryAgain && (
            <Button
              onClick={() => {
                mutate({ captureId });
              }}
            >
              Try again
            </Button>
          )}
        </AnalysisCard>
      ) : (
        <Card isFeatured className="flex flex-col items-start gap-4">
          <Button
            onClick={() => {
              mutate({ captureId });
            }}
          >
            Find the spark
          </Button>
        </Card>
      )}
      <SourceText data={data} />
    </div>
  );
}

export function AnalysisScreen({
  captureId,
  shouldAnalyze,
}: {
  captureId: string;
  shouldAnalyze: boolean;
}) {
  return (
    <AppFrame>
      <main className="mx-auto flex max-w-3xl flex-col items-stretch gap-6 px-6 pt-8 pb-14">
        <ButtonLink href="/inbox" variant="plain" className="self-start">
          Back to your inbox
        </ButtonLink>
        <AnalysisContent captureId={captureId} shouldAnalyze={shouldAnalyze} />
      </main>
    </AppFrame>
  );
}
