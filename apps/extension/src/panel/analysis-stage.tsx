import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appCodeOf, describeChannelFit, describeDuplicates } from "@scroll-spark/api/client";
import type { CapturedAnalysis } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { AnalysisCard } from "@scroll-spark/ui/analysis-card";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { FitCheck } from "@scroll-spark/ui/fit-check";
import { Reveal } from "@scroll-spark/ui/reveal";
import { ideaFailureMessage } from "@scroll-spark/ui/ship-messages";
import { TrendsLinks } from "@scroll-spark/ui/trends-links";

import { Failure } from "./failure";

type Analysis = NonNullable<CapturedAnalysis["analysis"]>;

function FitSection({ analysis, webOrigin }: { analysis: Analysis; webOrigin: string }) {
  const now = new Date();
  const { channels, duplicates } = analysis;

  return (
    <FitCheck
      rows={(channels ?? []).map((fit) => describeChannelFit(fit, { now }))}
      duplicateNote={duplicates === null ? null : describeDuplicates(duplicates)}
      emptyAction={
        <ButtonLink href={`${webOrigin}/channels`} target="_blank" rel="noreferrer" variant="plain">
          Choose your channels
        </ButtonLink>
      }
    />
  );
}

function TrendsSection({ data }: { data: CapturedAnalysis }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const captureId = data.capture.id;
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

/** Stage 3. What the AI found, how it fits each channel, and the two ways to go on. */
export function AnalysisStage({
  first,
  webOrigin,
  connectUrl,
  onSaved,
  onDraft,
}: {
  /** The analysis as it came back, shown at once. Later reads refresh it, such as a new country. */
  first: CapturedAnalysis;
  webOrigin: string;
  connectUrl: string;
  onSaved: () => void;
  onDraft: () => void;
}) {
  const trpc = useTRPC();
  const captureId = first.capture.id;
  const query = useQuery(
    trpc.capture.get.queryOptions({ captureId }, { initialData: first, staleTime: Infinity }),
  );
  const save = useMutation(trpc.capture.saveAsIdea.mutationOptions({ onSuccess: onSaved }));
  const data = query.data;
  const analysis = data.analysis;
  const code = appCodeOf(save.error);

  if (analysis === null) {
    return null;
  }

  return (
    <Reveal>
      <div className="flex flex-col gap-6">
        <AnalysisCard
          status="ready"
          headingLevel={2}
          topic={analysis.topic}
          angle={analysis.angle}
          summary={analysis.summary}
          className="p-4!"
        />
        <FitSection analysis={analysis} webOrigin={webOrigin} />
        <TrendsSection data={data} />
        <div className="flex flex-col items-stretch gap-3">
          <Button
            disabled={save.isPending}
            onClick={() => {
              save.mutate({ captureId });
            }}
          >
            Save idea
          </Button>
          <Button variant="plain" disabled={save.isPending} onClick={onDraft}>
            Draft a post
          </Button>
          {save.isPending && <p role="status">Saving to Buffer Ideas…</p>}
          {save.isError && (
            <Failure
              code={code}
              message={ideaFailureMessage(code)}
              webOrigin={webOrigin}
              connectUrl={connectUrl}
              chooseChannelsLink={code === "INVALID_INPUT"}
            />
          )}
        </div>
      </div>
    </Reveal>
  );
}
