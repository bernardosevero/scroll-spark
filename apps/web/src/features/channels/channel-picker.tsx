"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { appCodeOf } from "@scroll-spark/api/client";
import type { ChannelView } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { Reveal } from "@scroll-spark/ui/reveal";

import { SessionOver } from "../capture/session-over";

const SERVICE_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  x: "X",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  instagram: "Instagram",
};

function serviceName(service: string) {
  return SERVICE_NAMES[service.toLowerCase()] ?? service;
}

function ChannelOption({
  channel,
  isChecked,
  onToggle,
}: {
  channel: ChannelView;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const { id, name, displayName, avatar, isSupported, unsupportedReason } = channel;
  const title = displayName ?? name;
  const reasonId = `reason-${id}`;

  return (
    <Reveal>
      <li
        className={`flex flex-col gap-1 rounded-print border-[3px] border-navy p-3 ${isSupported ? "bg-paper" : "bg-stone"}`}
      >
        <label
          className={`flex min-h-11 items-center gap-3 ${isSupported ? "cursor-pointer" : "cursor-not-allowed"}`}
        >
          <input
            type="checkbox"
            className="size-6 shrink-0 accent-spark"
            checked={isChecked}
            disabled={!isSupported}
            aria-describedby={isSupported ? undefined : reasonId}
            onChange={onToggle}
          />
          {avatar !== null && avatar.startsWith("https://") ? (
            // eslint-disable-next-line @next/next/no-img-element -- A remote avatar, sized by CSS.
            <img
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="size-9 shrink-0 rounded-full border-2 border-navy"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-navy bg-cream font-bold"
            >
              {title.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="font-bold wrap-anywhere">{title}</span>
            <span className="text-sm">{serviceName(channel.service)}</span>
          </span>
        </label>
        {unsupportedReason !== null && (
          <p id={reasonId} className="pl-9 text-sm">
            {unsupportedReason}
          </p>
        )}
      </li>
    </Reveal>
  );
}

export function ChannelPicker() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.buffer.channels.queryOptions());
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const save = useMutation(
    trpc.buffer.setDefaultChannels.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.buffer.channels.queryKey() });
        setPicked(null);
      },
    }),
  );

  if (query.isPending) {
    return <p role="status">Opening your channels…</p>;
  }

  if (query.error !== null) {
    return appCodeOf(query.error) === "NOT_SIGNED_IN" ? (
      <SessionOver />
    ) : (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-medium">We couldn&apos;t open your channels.</p>
        <Button
          variant="plain"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const { channels, defaultChannelIds } = query.data;

  if (channels.length === 0) {
    return (
      <Card>
        <p className="font-medium">No channels here yet. Connect one in Buffer, then come back.</p>
      </Card>
    );
  }

  const selected = picked ?? new Set(defaultChannelIds);
  const hasChoosable = channels.some((channel) => channel.isSupported);

  function toggle(id: string) {
    const next = new Set(selected);

    if (!next.delete(id)) {
      next.add(id);
    }

    save.reset();
    setPicked(next);
  }

  return (
    <section aria-labelledby="channels-title" className="flex flex-col gap-4">
      <h2 id="channels-title" className="font-display text-2xl font-extrabold">
        Start with these
      </h2>
      <ul className="flex flex-col gap-3">
        {channels.map((channel) => (
          <ChannelOption
            key={channel.id}
            channel={channel}
            isChecked={selected.has(channel.id)}
            onToggle={() => {
              toggle(channel.id);
            }}
          />
        ))}
      </ul>
      {!hasChoosable && (
        <p className="font-medium">None of these can be used yet. Try another organization.</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          disabled={!hasChoosable || picked === null || save.isPending}
          onClick={() => {
            save.mutate({ channelIds: [...selected] });
          }}
        >
          Save default channels
        </Button>
        <div role="status" className="font-medium empty:hidden">
          {save.isSuccess && picked === null ? "Saved. We'll start with these." : null}
        </div>
      </div>
      {save.isError &&
        (appCodeOf(save.error) === "NOT_SIGNED_IN" ? (
          <SessionOver />
        ) : (
          <p role="alert" className="font-medium text-danger">
            That didn&apos;t save, so try again.
          </p>
        ))}
    </section>
  );
}
