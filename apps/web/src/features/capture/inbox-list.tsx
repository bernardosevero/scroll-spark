"use client";

import { useQuery } from "@tanstack/react-query";

import { appCodeOf } from "@scroll-spark/api/client";
import type { Capture } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { Reveal } from "@scroll-spark/ui/reveal";

import { SessionOver } from "./session-over";
import { sourceLabel } from "./source";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function CaptureItem({ capture }: { capture: Capture }) {
  const { text, sourceUrl, sourceName, platform, createdAt } = capture;

  return (
    <Reveal>
      <article>
        <Card className="flex flex-col gap-2 p-4.5">
          <p className="line-clamp-4 wrap-anywhere whitespace-pre-line">{text}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-sm">
            <span>{DATE.format(new Date(createdAt))}</span>
            {platform === "example" && <span className="font-medium">Example</span>}
            {sourceUrl !== null && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-11 items-center font-medium wrap-anywhere text-blue underline"
              >
                {sourceLabel({ url: sourceUrl, name: sourceName })}
              </a>
            )}
          </p>
        </Card>
      </article>
    </Reveal>
  );
}

function InboxContent() {
  const trpc = useTRPC();
  const { data, error, isPending, refetch, isFetching } = useQuery(
    trpc.capture.inbox.queryOptions(),
  );

  if (isPending) {
    return <p role="status">Opening your inbox…</p>;
  }

  if (error !== null) {
    return appCodeOf(error) === "NOT_SIGNED_IN" ? (
      <SessionOver />
    ) : (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-medium">We couldn&apos;t open your inbox.</p>
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

  if (data.length === 0) {
    return (
      <Card>
        <p className="font-medium">Nothing here yet. Paste a post you liked, or try an example.</p>
      </Card>
    );
  }

  return data.map((capture) => <CaptureItem key={capture.id} capture={capture} />);
}

export function InboxList() {
  return (
    <section
      aria-labelledby="inbox-title"
      className="flex min-w-0 flex-[999_1_520px] flex-col gap-4"
    >
      <h2 id="inbox-title" className="font-display text-3xl font-extrabold">
        Your captures
      </h2>
      <InboxContent />
    </section>
  );
}
