"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  DRAFT_LANGUAGES,
  appCodeOf,
  characterLimitFor,
  countCharacters,
  findOverlap,
} from "@scroll-spark/api/client";
import type { ChannelView, DraftResult } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { AssistantPrompt } from "@scroll-spark/ui/assistant-prompt";
import { Button } from "@scroll-spark/ui/button";
import { DraftEditorView } from "@scroll-spark/ui/draft-editor-view";
import {
  draftFailureMessage,
  languageLabel,
  postFailureMessage,
  serviceName,
  voiceNote,
} from "@scroll-spark/ui/ship-messages";

import { SessionOver } from "../capture/session-over";

type Language = (typeof DRAFT_LANGUAGES)[number];
type Kind = "draft" | "queue";

/** When we can't write the draft ourselves, the user can still ask their own assistant. */
const OWN_ASSISTANT_CODES: ReadonlySet<string> = new Set(["LLM_FAILED", "DRAFT_LIMIT_REACHED"]);

function OwnAssistant(input: { captureId: string; channelId: string; language?: Language }) {
  const trpc = useTRPC();
  const prompt = useQuery(trpc.draft.assistantPrompt.queryOptions(input));

  return <AssistantPrompt prompt={prompt.data?.prompt ?? null} isLoading={prompt.isPending} />;
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
              {languageLabel(value)}
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
      {draft.isError && code !== null && OWN_ASSISTANT_CODES.has(code) && (
        <OwnAssistant {...draft.variables} />
      )}
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
    <DraftEditorView
      toolbar={
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
      }
      voiceNote={voice === null ? null : voiceNote(voice)}
      text={text}
      onTextChange={setText}
      count={count}
      limit={limit}
      isCloseToSource={findOverlap(text, sourceText).isClose}
      serviceLabel={serviceName(channel.service)}
      isBlocked={isBlocked}
      isSending={post.isPending}
      sentKind={isSentNow}
      sentMessage={
        isSentNow === null
          ? null
          : isSentNow === "draft"
            ? `Saved as a draft in Buffer for ${title}.`
            : `Added to the ${serviceName(channel.service)} queue in Buffer for ${title}.`
      }
      error={
        post.isError &&
        (code === "NOT_SIGNED_IN" ? (
          <SessionOver />
        ) : (
          <p role="alert" className="font-medium text-danger">
            {postFailureMessage(code, post.variables.kind)}
          </p>
        ))
      }
      onSend={(kind) => {
        setSent(null);
        post.mutate({ captureId, channelId: channel.id, text, kind });
      }}
    />
  );
}
