import { useId } from "react";
import type { ReactNode } from "react";

import { Button } from "./button";
import { TextAreaField } from "./text-area-field";

export interface DraftEditorViewProps {
  /** Controls above the field, such as the language and "Write a draft". */
  toolbar: ReactNode;
  /** What the draft was written from. Null before a draft has been written. */
  voiceNote: string | null;
  text: string;
  onTextChange: (text: string) => void;
  count: number;
  /** The channel's character limit, or null when we can't enforce one. */
  limit: number | null;
  isCloseToSource: boolean;
  /** The service's name, such as "LinkedIn". It names the queue button. */
  serviceLabel: string;
  /** True when there's nothing to send, or the text is over the limit. */
  isBlocked: boolean;
  isSending: boolean;
  sentKind: "draft" | "queue" | null;
  sentMessage: string | null;
  /** An alert for a failed send. The text above stays as the user left it. */
  error: ReactNode;
  onSend: (kind: "draft" | "queue") => void;
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

/**
 * The editor for a post: the text, its count, and the two ways to send it. "Save as draft" is the
 * main action, because a queued post may publish for real.
 */
export function DraftEditorView({
  toolbar,
  voiceNote,
  text,
  onTextChange,
  count,
  limit,
  isCloseToSource,
  serviceLabel,
  isBlocked,
  isSending,
  sentKind,
  sentMessage,
  error,
  onSend,
}: DraftEditorViewProps) {
  const counterId = useId();

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      {voiceNote !== null && (
        <>
          <h3 className="font-display text-2xl font-extrabold">Sounds like you?</h3>
          <p>{voiceNote}</p>
        </>
      )}
      <TextAreaField
        label="Your draft"
        value={text}
        placeholder="Write your own, or ask for a draft above."
        aria-describedby={counterId}
        onChange={(event) => {
          onTextChange(event.target.value);
        }}
      />
      <Counter id={counterId} count={count} limit={limit} />
      {isCloseToSource && (
        <p role="status" className="font-medium">
          Parts of this are close to the post you captured. Put them in your own words before you
          share it.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isBlocked || isSending || sentKind === "draft"}
          onClick={() => {
            onSend("draft");
          }}
        >
          Save as draft
        </Button>
        <Button
          variant="plain"
          disabled={isBlocked || isSending || sentKind === "queue"}
          onClick={() => {
            onSend("queue");
          }}
        >
          Add to {serviceLabel} queue
        </Button>
      </div>
      {isSending && <p role="status">Sending it to Buffer…</p>}
      {sentMessage !== null && (
        <p role="status" className="font-bold">
          {sentMessage}
        </p>
      )}
      {error}
    </div>
  );
}
