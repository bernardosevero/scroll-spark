"use client";

import { useState } from "react";

import { Button, ButtonLink } from "./button";

export interface AssistantPromptProps {
  /** Null while it loads, or when it couldn't be built. */
  prompt: string | null;
  isLoading: boolean;
}

const ASSISTANTS = [
  { name: "Claude", href: "https://claude.ai/new" },
  { name: "ChatGPT", href: "https://chatgpt.com/" },
] as const;

/** When we can't write the draft, the user can ask their own assistant with a prompt we prepared. */
export function AssistantPrompt({ prompt, isLoading }: AssistantPromptProps) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  if (prompt === null) {
    return isLoading ? <p role="status">Preparing a prompt for your own assistant…</p> : null;
  }

  return (
    <section
      aria-labelledby="assistant-prompt-title"
      className="flex w-full flex-col gap-3 rounded-print border-2 border-navy bg-paper p-4"
    >
      <h3 id="assistant-prompt-title" className="font-display text-lg font-extrabold">
        Write it with your own assistant
      </h3>
      <p>
        Copy this prompt into Claude or ChatGPT, then paste the answer into your draft below. It has
        the angle and your voice, and never the original post.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="plain"
          onClick={() => {
            navigator.clipboard.writeText(prompt).then(
              () => {
                setCopy("copied");
              },
              () => {
                setCopy("failed");
              },
            );
          }}
        >
          Copy prompt
        </Button>
        {ASSISTANTS.map(({ name, href }) => (
          <ButtonLink
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant="plain"
          >
            Open {name}
          </ButtonLink>
        ))}
      </div>
      {copy !== "idle" && (
        <p role="status" className="font-bold">
          {copy === "copied"
            ? "Copied."
            : "Your browser didn't allow copying. Select the prompt below instead."}
        </p>
      )}
      <details open={copy === "failed"}>
        <summary className="cursor-pointer font-bold">See the prompt</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-print border-2 border-navy p-3 font-sans text-sm break-words whitespace-pre-wrap">
          {prompt}
        </pre>
      </details>
    </section>
  );
}
