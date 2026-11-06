import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";

import { MAX_CAPTURE_LENGTH, appCodeOf } from "@scroll-spark/api/client";
import type { CapturePlatform } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { ChipButton } from "@scroll-spark/ui/chip-button";
import { Reveal } from "@scroll-spark/ui/reveal";
import { SparkMark } from "@scroll-spark/ui/spark-mark";
import { TextAreaField } from "@scroll-spark/ui/text-area-field";

import type { PendingCapture } from "../capture/pending-capture";

interface Source {
  url: string;
  platform: CapturePlatform;
  name: string | null;
}

const NOTICES = {
  empty:
    "We couldn't find a post here. Select the text you want and capture again, or paste it below.",
  blocked: "Chrome doesn't let extensions read this page. Paste the text below instead.",
} as const;

function startOf(pending: PendingCapture): { text: string; source: Source | null; notice: string } {
  if (pending.status === "found") {
    const { text, url, platform, author } = pending.capture;
    return { text, source: { url, platform, name: author }, notice: "" };
  }

  if (pending.status === "empty") {
    const source =
      pending.url === null || pending.platform === null
        ? null
        : { url: pending.url, platform: pending.platform, name: null };
    return { text: "", source, notice: NOTICES.empty };
  }

  return { text: "", source: null, notice: NOTICES.blocked };
}

const sourceLabel = ({ url, name }: Source) => name ?? new URL(url).hostname.replace(/^www\./, "");

function Saved({
  captureId,
  webOrigin,
  onFinish,
}: {
  captureId: string;
  webOrigin: string;
  onFinish: () => void;
}) {
  return (
    <Reveal>
      <Card isFeatured className="flex flex-col items-start gap-4 p-4!">
        <h2 className="flex items-center gap-2 font-display text-2xl leading-7 font-extrabold tracking-tight">
          <SparkMark size={22} />
          Saved to your inbox
        </h2>
        <p className="font-medium">It&apos;s waiting for you on the website.</p>
        <ButtonLink href={`${webOrigin}/inbox/${captureId}`} target="_blank" rel="noreferrer">
          Open in your inbox
        </ButtonLink>
        <Button variant="plain" onClick={onFinish}>
          Capture another
        </Button>
      </Card>
    </Reveal>
  );
}

/** Shows what was captured, always, so the user can fix it before anything is saved. */
export function ReviewForm({
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
  const create = useMutation(trpc.capture.create.mutationOptions());

  if (create.isSuccess) {
    return <Saved captureId={create.data.id} webOrigin={webOrigin} onFinish={onFinish} />;
  }

  const isOverLimit = Array.from(text).length > MAX_CAPTURE_LENGTH;
  const hasSessionEnded = appCodeOf(create.error) === "NOT_SIGNED_IN";

  function save(event: FormEvent) {
    event.preventDefault();
    create.mutate({
      text,
      sourceUrl: source?.url ?? null,
      platform: source?.platform ?? "pasted",
      sourceName: source?.name ?? null,
    });
  }

  return (
    <Reveal>
      <Card isFeatured className="p-4!">
        <form onSubmit={save} className="flex flex-col gap-4">
          <TextAreaField
            label="Captured text. Fix anything that looks off."
            placeholder="Paste the text here"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />

          <div role="status" className="flex flex-col gap-2 empty:hidden">
            {start.notice !== "" && text === "" && <p className="font-medium">{start.notice}</p>}
            {isOverLimit && (
              <p className="font-medium">
                We keep the first {MAX_CAPTURE_LENGTH.toLocaleString("en-US")} characters.
              </p>
            )}
          </div>

          {source !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 font-medium wrap-anywhere">From {sourceLabel(source)}</span>
              <ChipButton
                onClick={() => {
                  setSource(null);
                }}
              >
                Remove link
              </ChipButton>
            </div>
          )}

          {create.isError &&
            (hasSessionEnded ? (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p className="font-medium">
                  Your sign-in has ended. Sign in again, and your text will still be here.
                </p>
                <ButtonLink href={connectUrl} target="_blank" rel="noreferrer" variant="plain">
                  Sign in on the website
                </ButtonLink>
              </div>
            ) : (
              <p role="alert" className="font-medium text-danger">
                That didn&apos;t save. Your text is still here, so you can try again.
              </p>
            ))}

          <Button type="submit" disabled={text.trim() === "" || create.isPending}>
            Save to inbox
          </Button>
        </form>
      </Card>
    </Reveal>
  );
}
