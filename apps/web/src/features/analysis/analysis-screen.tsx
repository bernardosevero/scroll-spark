"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { appCodeOf, describeChannelFit, describeDuplicates } from "@scroll-spark/api/client";
import type { CapturedAnalysis } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { ChipLink } from "@scroll-spark/ui/chip-link";
import { FitRow } from "@scroll-spark/ui/fit-row";
import { Reveal } from "@scroll-spark/ui/reveal";

import { SessionOver } from "../capture/session-over";
import { ShipPanel } from "../ship/ship-panel";
import { AppFrame } from "../shell/app-frame";

const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["BR", "Brazil"],
  ["PT", "Portugal"],
  ["ES", "Spain"],
  ["MX", "Mexico"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IN", "India"],
] as const;

function analysisFailureMessage(code: string | null) {
  switch (code) {
    case "LLM_REFUSED":
      return "We couldn't analyze this one. Your capture is safe in your inbox.";
    case "ANALYSIS_LIMIT_REACHED":
      return "That's today's limit reached. Your capture is safe, so come back tomorrow.";
    default:
      return "That didn't work this time. Your capture is safe, so you can try again.";
  }
}

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

/** How the capture relates to each channel: counts and dates, never a prediction. */
function FitCheck({ analysis }: { analysis: Analysis }) {
  const { channels, duplicates } = analysis;
  const now = new Date();

  if (channels === null || channels.length === 0) {
    return (
      <section aria-labelledby="fit-title" className="flex flex-col items-start gap-2">
        <h2 id="fit-title" className="font-display text-2xl font-extrabold">
          How it fits your channels
        </h2>
        <p>There&apos;s no fit check for this one yet.</p>
        <ButtonLink href="/channels" variant="plain">
          Choose your channels
        </ButtonLink>
      </section>
    );
  }

  const duplicateNote = duplicates === null ? null : describeDuplicates(duplicates);

  return (
    <section aria-labelledby="fit-title" className="flex flex-col gap-3">
      <h2 id="fit-title" className="font-display text-2xl font-extrabold">
        How it fits your channels
      </h2>
      <ul className="flex flex-col gap-3">
        {channels.map((fit) => (
          <li key={fit.channelId}>
            <FitRow {...describeChannelFit(fit, { now })} />
          </li>
        ))}
      </ul>
      {duplicateNote !== null && <p className="font-medium">{duplicateNote}</p>}
    </section>
  );
}

function TrendsLinks({ captureId, data }: { captureId: string; data: CapturedAnalysis }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setGeo = useMutation(
    trpc.settings.setTrendsGeo.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.capture.get.queryFilter({ captureId })),
    }),
  );
  const trends = data.analysis?.trends;

  return (
    <section aria-labelledby="trends-title" className="flex flex-col gap-3">
      <h2 id="trends-title" className="font-display text-2xl font-extrabold">
        View on Google Trends
      </h2>
      <div className="flex flex-wrap gap-2">
        {trends?.links.map(({ phrase, url }) => (
          <ChipLink key={phrase} href={url}>
            {phrase}
          </ChipLink>
        ))}
        {trends?.compareUrl && <ChipLink href={trends.compareUrl}>Compare all</ChipLink>}
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
        Country
        <select
          value={data.trendsGeo}
          disabled={setGeo.isPending}
          onChange={(event) => {
            setGeo.mutate({ geo: event.target.value });
          }}
          className="min-h-11 rounded-print border-2 border-navy bg-paper px-2 font-medium"
        >
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {setGeo.isError && (
        <p role="alert" className="font-medium text-danger">
          That country didn&apos;t save, so try again.
        </p>
      )}
    </section>
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
          <Card isFeatured className="flex flex-col gap-4">
            <p className="text-sm font-bold">{analysis.topic}</p>
            <h1 className="font-display text-4xl leading-10 font-extrabold tracking-tight">
              {analysis.angle}
            </h1>
            <p>{analysis.summary}</p>
          </Card>
          <FitCheck analysis={analysis} />
          <TrendsLinks captureId={captureId} data={data} />
          <ShipPanel captureId={captureId} sourceText={data.capture.text} />
          <SourceText data={data} />
        </div>
      </Reveal>
    );
  }

  const code = appCodeOf(analyze.error);

  return (
    <div className="flex flex-col gap-8">
      <Card isFeatured className="flex flex-col items-start gap-4">
        {analyze.isPending ? (
          <p role="status" className="font-display text-3xl font-extrabold">
            Finding the spark…
          </p>
        ) : (
          <>
            {analyze.isError &&
              (code === "NOT_SIGNED_IN" ? (
                <SessionOver />
              ) : (
                <p role="alert" className="font-medium text-danger">
                  {analysisFailureMessage(code)}
                </p>
              ))}
            {code !== "ANALYSIS_LIMIT_REACHED" && code !== "NOT_SIGNED_IN" && (
              <Button
                onClick={() => {
                  mutate({ captureId });
                }}
              >
                {analyze.isError ? "Try again" : "Find the spark"}
              </Button>
            )}
          </>
        )}
      </Card>
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
