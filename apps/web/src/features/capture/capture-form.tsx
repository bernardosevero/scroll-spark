"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { MAX_CAPTURE_LENGTH, appCodeOf } from "@scroll-spark/api/client";
import type { CapturePlatform } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { ChipButton } from "@scroll-spark/ui/chip-button";
import { TextAreaField } from "@scroll-spark/ui/text-area-field";

import { EXAMPLE_POSTS } from "./examples";
import { SessionOver } from "./session-over";
import { sourceLabel } from "./source";

interface Source {
  url: string;
  platform: CapturePlatform;
  name: string | null;
}

/** Only picks which button to show. The server decides what a link really is. */
const isSingleLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

export function CaptureForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [cantRead, setCantRead] = useState(false);

  const create = useMutation(
    trpc.capture.create.mutationOptions({
      onSuccess({ id }) {
        // `spark=1` asks the next page to analyze it, so opening an old capture never spends.
        router.push(`/inbox/${id}?spark=1`);
      },
    }),
  );
  const readLink = useMutation(trpc.capture.readLink.mutationOptions());

  const length = Array.from(text).length;
  const isOverLimit = length > MAX_CAPTURE_LENGTH;
  const isBlank = text.trim() === "";
  // Stays busy after saving, until the next page arrives, so a second click can't save twice.
  const isBusy = create.isPending || create.isSuccess || readLink.isPending;
  const failure = create.error ?? readLink.error;

  function askForText(nextSource: Source | null) {
    setText("");
    setSource(nextSource);
    setCantRead(true);
    field.current?.focus();
  }

  function read() {
    const url = text.trim();
    setCantRead(false);
    create.reset();

    readLink.mutate(
      { url },
      {
        onSuccess(result) {
          if (result.status === "found") {
            setText(result.text);
            setSource({ url, platform: result.platform, name: result.sourceName });
          } else {
            askForText({ url, platform: result.platform, name: null });
          }
        },
      },
    );
  }

  function save() {
    readLink.reset();

    create.mutate({
      text,
      sourceUrl: source?.url ?? null,
      platform: source?.platform ?? "pasted",
      sourceName: source?.name ?? null,
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    if (isSingleLink(text)) {
      read();
    } else {
      save();
    }
  }

  return (
    <section aria-labelledby="capture-title" className="min-w-0 flex-[1_1_340px]">
      <Card isFeatured>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h1
            id="capture-title"
            className="font-display text-4xl leading-10 font-extrabold tracking-tight"
          >
            What caught your eye?
          </h1>

          <TextAreaField
            ref={field}
            label="Paste a post or a link"
            placeholder="Paste the text here"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setCantRead(false);
            }}
          />

          <div role="status" className="flex flex-col gap-2 empty:hidden">
            {cantRead && (
              <p className="font-medium">
                We can&apos;t read that page. Paste the text here instead.
              </p>
            )}
            {isOverLimit && (
              <p className="font-medium">
                We keep the first {MAX_CAPTURE_LENGTH.toLocaleString("en-US")} characters.
              </p>
            )}
          </div>

          {source !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 font-medium wrap-anywhere">
                From {sourceLabel({ url: source.url, name: source.name })}
              </span>
              <ChipButton
                onClick={() => {
                  setSource(null);
                }}
              >
                Remove link
              </ChipButton>
            </div>
          )}

          {failure !== null &&
            (appCodeOf(failure) === "NOT_SIGNED_IN" ? (
              <SessionOver />
            ) : (
              <p role="alert" className="font-medium text-danger">
                {create.isError
                  ? "That didn't save. Your text is still here, so you can try again."
                  : "That link didn't open. Try again, or paste the text instead."}
              </p>
            ))}

          <Button type="submit" disabled={isBlank || isBusy}>
            {isSingleLink(text) ? "Read this link" : "Find the spark"}
          </Button>

          <div className="flex flex-col gap-2 pt-1">
            <p className="text-sm font-bold">No post handy? Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_POSTS.map((example) => (
                <ChipButton
                  key={example.label}
                  disabled={isBusy}
                  onClick={() => {
                    create.mutate({
                      text: example.text,
                      sourceUrl: null,
                      platform: "example",
                      sourceName: null,
                    });
                  }}
                >
                  {example.label}
                </ChipButton>
              ))}
            </div>
          </div>
        </form>
      </Card>
    </section>
  );
}
