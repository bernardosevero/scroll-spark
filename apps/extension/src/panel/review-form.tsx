import type { FormEvent, ReactNode } from "react";

import { MAX_CAPTURE_LENGTH } from "@scroll-spark/api/client";
import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { ChipButton } from "@scroll-spark/ui/chip-button";
import { Reveal } from "@scroll-spark/ui/reveal";
import { TextAreaField } from "@scroll-spark/ui/text-area-field";

import { sourceLabel } from "./review-start";
import type { Source } from "./review-start";

/** Stage 1. Shows what was captured, always, so the user can fix it before anything is sent. */
export function ReviewForm({
  text,
  onTextChange,
  source,
  onRemoveSource,
  notice,
  error,
  onFind,
}: {
  text: string;
  onTextChange: (text: string) => void;
  source: Source | null;
  onRemoveSource: () => void;
  notice: string;
  /** A failure from saving the capture. The text above stays as the user left it. */
  error: ReactNode;
  onFind: () => void;
}) {
  const isOverLimit = Array.from(text).length > MAX_CAPTURE_LENGTH;

  function submit(event: FormEvent) {
    event.preventDefault();
    onFind();
  }

  return (
    <Reveal>
      <Card isFeatured className="p-4!">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextAreaField
            label="Captured text. Fix anything that looks off."
            placeholder="Paste the text here"
            value={text}
            onChange={(event) => {
              onTextChange(event.target.value);
            }}
          />

          <div role="status" className="flex flex-col gap-2 empty:hidden">
            {notice !== "" && text === "" && <p className="font-medium">{notice}</p>}
            {isOverLimit && (
              <p className="font-medium">
                We keep the first {MAX_CAPTURE_LENGTH.toLocaleString("en-US")} characters.
              </p>
            )}
          </div>

          {source !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 font-medium wrap-anywhere">From {sourceLabel(source)}</span>
              <ChipButton onClick={onRemoveSource}>Remove link</ChipButton>
            </div>
          )}

          {error}

          <Button type="submit" disabled={text.trim() === ""}>
            Find the spark
          </Button>
        </form>
      </Card>
    </Reveal>
  );
}
