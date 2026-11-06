import { z } from "zod";

/** Choices in the editor's language switch. "same" follows the channel's most recent post. */
export const DRAFT_LANGUAGES = [
  "same",
  "english",
  "portuguese",
  "spanish",
  "french",
  "german",
] as const;

const captureId = z.uuid();

export const shipCaptureInputSchema = z.object({ captureId });

export const savedIdeaSchema = z.object({
  ideaId: z.string(),
  /** False when the capture was already saved, so Buffer wasn't called. */
  isNew: z.boolean(),
});

export const ideaStateSchema = z.object({ ideaId: z.string().nullable() });

export const draftInputSchema = z.object({
  captureId,
  channelId: z.string().min(1),
  language: z.enum(DRAFT_LANGUAGES).default("same"),
});

/** What the model must return. Parsed by the service, because model output is never trusted. */
export const llmDraftSchema = z.object({ text: z.string().trim().min(1) });

export const draftResultSchema = z.object({
  text: z.string(),
  voice: z.object({
    /** How many of the channel's posts were usable as voice samples, at most 8. */
    sampleCount: z.number().int().nonnegative(),
    /** False when there were too few posts to match, so the draft is in a plain voice. */
    isMatched: z.boolean(),
  }),
  overlap: z.object({ isClose: z.boolean(), share: z.number() }),
});

export const postInputSchema = z.object({
  captureId,
  channelId: z.string().min(1),
  // Each channel's own limit is checked by the service. This only bounds what we parse.
  text: z.string().max(10_000),
  kind: z.enum(["draft", "queue"]),
});

export const postResultSchema = z.object({
  postId: z.string(),
  kind: z.enum(["draft", "queue"]),
  channelId: z.string(),
});

export type ShipCaptureInput = z.infer<typeof shipCaptureInputSchema>;
export type SavedIdea = z.infer<typeof savedIdeaSchema>;
export type IdeaState = z.infer<typeof ideaStateSchema>;
export type DraftInput = z.infer<typeof draftInputSchema>;
export type DraftResult = z.infer<typeof draftResultSchema>;
export type PostInput = z.infer<typeof postInputSchema>;
export type PostResult = z.infer<typeof postResultSchema>;
