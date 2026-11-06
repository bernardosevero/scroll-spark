"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { appCodeOf } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button, ButtonLink } from "@scroll-spark/ui/button";

import { SessionOver } from "../capture/session-over";
import { ChannelChoice } from "./channel-choice";
import { DraftEditor } from "./draft-editor";
import { ideaFailureMessage } from "./ship-messages";

function SaveIdea({ captureId }: { captureId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const idea = useQuery(trpc.capture.ideaOf.queryOptions({ captureId }));
  const save = useMutation(
    trpc.capture.saveAsIdea.mutationOptions({
      onSuccess({ ideaId }) {
        queryClient.setQueryData(trpc.capture.ideaOf.queryKey({ captureId }), { ideaId });
      },
    }),
  );
  const code = appCodeOf(save.error);

  if (idea.data?.ideaId != null) {
    return (
      <p role="status" className="font-bold">
        Saved to Buffer Ideas
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="plain"
        disabled={idea.isPending || save.isPending}
        onClick={() => {
          save.mutate({ captureId });
        }}
      >
        Save as idea
      </Button>
      {save.isPending && <p role="status">Saving to Buffer Ideas…</p>}
      {save.isError &&
        (code === "NOT_SIGNED_IN" ? (
          <SessionOver />
        ) : (
          <p role="alert" className="font-medium text-danger">
            {ideaFailureMessage(code)}
          </p>
        ))}
    </div>
  );
}

function ChannelStep({ captureId, sourceText }: { captureId: string; sourceText: string }) {
  const trpc = useTRPC();
  const channels = useQuery(trpc.buffer.channels.queryOptions());
  const [pickedId, setPickedId] = useState<string | null>(null);

  if (channels.isPending) {
    return <p role="status">Looking at your channels…</p>;
  }

  if (channels.isError) {
    return <p role="alert">We couldn&apos;t read your channels. Reload to try again.</p>;
  }

  const { organizationId, channels: all, defaultChannelIds } = channels.data;
  const supported = all.filter(({ isSupported }) => isSupported);
  const selectedId =
    pickedId ??
    defaultChannelIds.find((id) => supported.some((channel) => channel.id === id)) ??
    supported[0]?.id ??
    null;
  const selected = supported.find(({ id }) => id === selectedId);

  if (organizationId === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p>Choose your Buffer organization first, so we know where to save.</p>
        <ButtonLink href="/channels" variant="plain">
          Choose organization
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ChannelChoice channels={all} selectedId={selectedId} onSelect={setPickedId} />
      {selected === undefined ? (
        <p>
          None of your channels can be posted to from here yet. You can still save this as an idea.
        </p>
      ) : (
        <DraftEditor
          key={captureId}
          captureId={captureId}
          channel={selected}
          sourceText={sourceText}
        />
      )}
    </div>
  );
}

/** Save the capture as a Buffer Idea, write a draft for a channel, and send it to Buffer. */
export function ShipPanel({ captureId, sourceText }: { captureId: string; sourceText: string }) {
  return (
    <section
      aria-labelledby="ship-title"
      className="flex flex-col gap-6 rounded-print border-[3px] border-navy bg-paper p-6"
    >
      <h2 id="ship-title" className="font-display text-2xl font-extrabold">
        Make it a post
      </h2>
      <SaveIdea captureId={captureId} />
      <ChannelStep captureId={captureId} sourceText={sourceText} />
    </section>
  );
}
