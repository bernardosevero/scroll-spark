"use client";

import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";

import {
  DRAFT_LANGUAGES,
  appCodeOf,
  characterLimitFor,
  countCharacters,
  findOverlap,
} from "@scroll-spark/api/client";
import type { ChannelView, DraftResult } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button } from "@scroll-spark/ui/button";
import { TextAreaField } from "@scroll-spark/ui/text-area-field";

import { SessionOver } from "../capture/session-over";
import { draftFailureMessage, postFailureMessage, serviceName } from "./ship-messages";

type Language = (typeof DRAFT_LANGUAGES)[number];
type Kind = "draft" | "queue";

const LANGUAGE_LABELS: Record<Language, string> = {
  same: "Same as my recent posts",
  english: "English",
  portuguese: "Portuguese",
  spanish: "Spanish",
  french: "French",
  german: "German",
};

const MIN_SAMPLES = 3;

function voiceNote({ sampleCount, isMatched }: DraftResult["voice"]) {
  if (isMatched) {
    return `Written from your last ${String(sampleCount)} posts on this channel.`;
  }

  const found =
    sampleCount === 0
      ? "no usable posts"
      : `only ${String(sampleCount)} usable post${sampleCount === 1 ? "" : "s"}`;

  return `We found ${found} on this channel, and a draft needs ${String(MIN_SAMPLES)} to sound like you. This one is in a plain voice, so make it yours.`;
}

function Counter({ id, count, limit }: { id: string; count: number; limit: number | null }) {
  const over = limit === null ? 0 : count - limit;

  return (
    <p id={id} className={`text-sm ${over > 0 ? "font-bold text-danger" : ""}`}>
      {limit === null
        ? `${String(count)} characters`
        : `${String(count)} of ${String(limit)} characters`}
      {over > 0 && `. That's ${String(over)} over, so shorten it to post.`}
    </p>
  );
}

function WriteDraft({
  captureId,
  channel,
  onWritten,
  onWriting,
}: {
  captureId: string;
  channel: ChannelView;
  onWritten: (result: DraftResult) => void;
  onWriting: () => void;
}) {
  const trpc = useTRPC();
  const [language, setLanguage] = useState<Language>("same");
  const [hasWritten, setHasWritten] = useState(false);
  const draft = useMutation(
    trpc.draft.create.mutationOptions({
      onSuccess(result) {
        setHasWritten(true);
        onWritten(result);
      },
    }),
  );
  const code = appCodeOf(draft.error);

  return (
    <div className="flex flex-col items-start gap-3">
      <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
        Write in
        <select
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value as Language);
          }}
          className="min-h-11 rounded-print border-2 border-navy bg-paper px-2 font-medium"
        >
          {DRAFT_LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {LANGUAGE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="plain"
        disabled={draft.isPending}
        onClick={() => {
          onWriting();
          draft.mutate({ captureId, channelId: channel.id, language });
        }}
      >
        {hasWritten ? "Write another draft" : "Write a draft"}
      </Button>
      {draft.isPending && <p role="status">Writing a draft in your voice…</p>}
      {draft.isError &&
        (code === "NOT_SIGNED_IN" ? (
          <SessionOver />
        ) : (
          <p role="alert" className="font-medium text-danger">
            {draftFailureMessage(code)}
          </p>
        ))}
    </div>
  );
}

function PostButtons({
  channel,
  isBlocked,
  sent,
  onPost,
  isPending,
}: {
  channel: ChannelView;
  isBlocked: boolean;
  sent: Kind | null;
  onPost: (kind: Kind) => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={isBlocked || isPending || sent === "draft"}
        onClick={() => {
          onPost("draft");
        }}
      >
        Save as draft
      </Button>
      <Button
        variant="plain"
        disabled={isBlocked || isPending || sent === "queue"}
        onClick={() => {
          onPost("queue");
        }}
      >
        Add to {serviceName(channel.service)} queue
      </Button>
    </div>
  );
}

export function DraftEditor({
  captureId,
  channel,
  sourceText,
}: {
  captureId: string;
  channel: ChannelView;
  sourceText: string;
}) {
  const trpc = useTRPC();
  const counterId = useId();
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<DraftResult["voice"] | null>(null);
  const [sent, setSent] = useState<{ kind: Kind; channelId: string; text: string } | null>(null);
  const post = useMutation(
    trpc.post.create.mutationOptions({
      onSuccess: (_result, { kind, channelId, text: sentText }) => {
        setSent({ kind, channelId, text: sentText });
      },
    }),
  );

  const limit = characterLimitFor(channel.service);
  const count = countCharacters(text);
  const isBlocked = text.trim() === "" || (limit !== null && count > limit);
  const isSentNow = sent?.channelId === channel.id && sent.text === text ? sent.kind : null;
  const title = channel.displayName ?? channel.name;
  const code = appCodeOf(post.error);

  return (
    <div className="flex flex-col gap-4">
      <WriteDraft
        captureId={captureId}
        channel={channel}
        onWriting={() => {
          post.reset();
        }}
        onWritten={(result) => {
          setText(result.text);
          setVoice(result.voice);
        }}
      />
      {voice !== null && (
        <>
          <h3 className="font-display text-2xl font-extrabold">Sounds like you?</h3>
          <p>{voiceNote(voice)}</p>
        </>
      )}
      <TextAreaField
        label="Your draft"
        value={text}
        placeholder="Write your own, or ask for a draft above."
        aria-describedby={counterId}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Counter id={counterId} count={count} limit={limit} />
      {findOverlap(text, sourceText).isClose && (
        <p role="status" className="font-medium">
          Parts of this are close to the post you captured. Put them in your own words before you
          share it.
        </p>
      )}
      <PostButtons
        channel={channel}
        isBlocked={isBlocked}
        sent={isSentNow}
        isPending={post.isPending}
        onPost={(kind) => {
          setSent(null);
          post.mutate({ captureId, channelId: channel.id, text, kind });
        }}
      />
      {post.isPending && <p role="status">Sending it to Buffer…</p>}
      {isSentNow !== null && (
        <p role="status" className="font-bold">
          {isSentNow === "draft"
            ? `Saved as a draft in Buffer for ${title}.`
            : `Added to the ${serviceName(channel.service)} queue in Buffer for ${title}.`}
        </p>
      )}
      {post.isError &&
        (code === "NOT_SIGNED_IN" ? (
          <SessionOver />
        ) : (
          <p role="alert" className="font-medium text-danger">
            {postFailureMessage(code, post.variables.kind)}
          </p>
        ))}
    </div>
  );
}
