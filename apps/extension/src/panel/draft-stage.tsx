import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  DRAFT_LANGUAGES,
  appCodeOf,
  characterLimitFor,
  chooseChannel,
  countCharacters,
  findOverlap,
} from "@scroll-spark/api/client";
import type { ChannelView, DraftResult } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { DraftEditorView } from "@scroll-spark/ui/draft-editor-view";
import { Reveal } from "@scroll-spark/ui/reveal";
import {
  draftFailureMessage,
  languageLabel,
  postFailureMessage,
  serviceName,
  voiceNote,
} from "@scroll-spark/ui/ship-messages";

import { Failure } from "./failure";
import type { Sent } from "./done-stage";

type Language = (typeof DRAFT_LANGUAGES)[number];

interface Links {
  webOrigin: string;
  connectUrl: string;
}

const channelTitle = (channel: ChannelView) => channel.displayName ?? channel.name;

function WriteDraft({
  captureId,
  channel,
  language,
  onLanguage,
  onWritten,
  links,
}: {
  captureId: string;
  channel: ChannelView;
  language: Language;
  onLanguage: (language: Language) => void;
  onWritten: (result: DraftResult) => void;
  links: Links;
}) {
  const trpc = useTRPC();
  const hasStarted = useRef(false);
  const draft = useMutation(trpc.draft.create.mutationOptions({ onSuccess: onWritten }));
  const { mutate } = draft;
  const code = appCodeOf(draft.error);

  // The user chose "Draft a post", so the first draft starts now. Later ones wait to be asked for.
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      mutate({ captureId, channelId: channel.id, language });
    }
  }, [captureId, channel.id, language, mutate]);

  return (
    <div className="flex flex-col items-stretch gap-3">
      <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
        Write in
        <select
          value={language}
          onChange={(event) => {
            onLanguage(event.target.value as Language);
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
          mutate({ captureId, channelId: channel.id, language });
        }}
      >
        {draft.isSuccess ? "Write another draft" : "Write a draft"}
      </Button>
      {draft.isPending && <p role="status">Writing a draft in your voice…</p>}
      {draft.isError && (
        <Failure
          code={code}
          message={draftFailureMessage(code)}
          webOrigin={links.webOrigin}
          connectUrl={links.connectUrl}
        />
      )}
    </div>
  );
}

function Editor({
  captureId,
  sourceText,
  channel,
  language,
  onLanguage,
  links,
  onSent,
}: {
  captureId: string;
  sourceText: string;
  channel: ChannelView;
  language: Language;
  onLanguage: (language: Language) => void;
  links: Links;
  onSent: (sent: Sent) => void;
}) {
  const trpc = useTRPC();
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<DraftResult["voice"] | null>(null);
  const post = useMutation(
    trpc.post.create.mutationOptions({
      onSuccess: (_result, { kind }) => {
        onSent({
          kind,
          channelTitle: channelTitle(channel),
          serviceLabel: serviceName(channel.service),
        });
      },
    }),
  );
  const limit = characterLimitFor(channel.service);
  const count = countCharacters(text);
  const code = appCodeOf(post.error);

  return (
    <DraftEditorView
      toolbar={
        <WriteDraft
          captureId={captureId}
          channel={channel}
          language={language}
          onLanguage={onLanguage}
          links={links}
          onWritten={(result) => {
            post.reset();
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
      isBlocked={text.trim() === "" || (limit !== null && count > limit)}
      // A queued post may publish for real, so it is sent once and never retried on its own.
      isSending={post.isPending}
      sentKind={null}
      sentMessage={null}
      error={
        post.isError && (
          <Failure
            code={code}
            message={postFailureMessage(code, post.variables.kind)}
            webOrigin={links.webOrigin}
            connectUrl={links.connectUrl}
          />
        )
      }
      onSend={(kind) => {
        post.mutate({ captureId, channelId: channel.id, text, kind });
      }}
    />
  );
}

function languageSentence(language: Language) {
  return language === "same" ? "in your usual language" : `in ${languageLabel(language)}`;
}

/**
 * Stage 5. A draft for one of the user's channels, in an editor. "Save as draft" is the main
 * action. Choosing the organization and default channels stays on the website.
 */
export function DraftStage({
  captureId,
  sourceText,
  links,
  onSent,
}: {
  captureId: string;
  sourceText: string;
  links: Links;
  onSent: (sent: Sent) => void;
}) {
  const trpc = useTRPC();
  const channels = useQuery(trpc.buffer.channels.queryOptions());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("same");

  if (channels.isPending) {
    return <p role="status">Looking at your channels…</p>;
  }

  if (channels.isError) {
    const code = appCodeOf(channels.error);

    return (
      <Failure
        code={code}
        message="We couldn't read your channels. Close the panel and open it again to try once more."
        webOrigin={links.webOrigin}
        connectUrl={links.connectUrl}
      />
    );
  }

  const selected = chooseChannel(channels.data, pickedId);

  if (channels.data.organizationId === null || selected === null) {
    return (
      <Card className="flex flex-col items-start gap-4 p-4!">
        <h2 className="font-display text-2xl leading-7 font-extrabold tracking-tight">
          Choose where to post
        </h2>
        <p className="font-medium">
          {channels.data.organizationId === null
            ? "Choose your Buffer organization and channels on the website first."
            : "None of your channels can be posted to from here yet."}
        </p>
        <ButtonLink
          href={`${links.webOrigin}/channels`}
          target="_blank"
          rel="noreferrer"
          variant="plain"
        >
          Choose your channels
        </ButtonLink>
      </Card>
    );
  }

  const supported = channels.data.channels.filter(({ isSupported }) => isSupported);

  return (
    <Reveal>
      <Card isFeatured className="flex flex-col gap-4 p-4!">
        <h2 className="font-display text-2xl leading-7 font-extrabold tracking-tight">
          Draft for {channelTitle(selected)}, {languageSentence(language)}
        </h2>
        {supported.length > 1 && (
          <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
            Post to
            <select
              value={selected.id}
              onChange={(event) => {
                setPickedId(event.target.value);
              }}
              className="min-h-11 rounded-print border-2 border-navy bg-paper px-2 font-medium"
            >
              {supported.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channelTitle(channel)} · {serviceName(channel.service)}
                </option>
              ))}
            </select>
          </label>
        )}
        <Editor
          // A different channel starts a new draft, so one channel's text never goes to another.
          key={selected.id}
          captureId={captureId}
          sourceText={sourceText}
          channel={selected}
          language={language}
          onLanguage={setLanguage}
          links={links}
          onSent={onSent}
        />
      </Card>
    </Reveal>
  );
}
