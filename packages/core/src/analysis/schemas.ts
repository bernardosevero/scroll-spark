import { z } from "zod";

import { captureSchema } from "../capture/schemas";
import { channelFitSchema, duplicatesSchema, llmFitAnswerSchema } from "../fit/schemas";

const line = z.string().trim().min(1);

/**
 * What the model must return. It's parsed here, because model output is never trusted. The fit
 * part names channels, clusters, posts and Ideas by ID only, and code does the counting.
 */
export const llmAnalysisSchema = llmFitAnswerSchema.extend({
  summary: line,
  topic: line,
  /** One line on how this user could take the topic. */
  angle: line,
  /** Each 1 to 3 common words, since specific phrases come back empty on Google Trends. */
  trendPhrases: z.array(line).min(1).max(3),
});

export const analysisSchema = llmAnalysisSchema
  .omit({ channels: true, matchingIdeaIds: true })
  .extend({
    captureId: z.string(),
    model: z.string(),
    createdAt: z.iso.datetime(),
    /** The fit per channel as it was when the analysis ran. Null means no fit yet. */
    channels: z.array(channelFitSchema).nullable(),
    /** Ideas and queued posts that already cover this. Null means not checked. */
    duplicates: duplicatesSchema.nullable(),
  });

const analysisViewSchema = analysisSchema.extend({
  trends: z.object({
    links: z.array(z.object({ phrase: z.string(), url: z.url() })),
    /** Null when there's only one phrase, so nothing to compare. */
    compareUrl: z.url().nullable(),
  }),
});

export const captureIdInputSchema = z.object({ captureId: z.uuid() });

export const capturedAnalysisSchema = z.object({
  capture: captureSchema,
  analysis: analysisViewSchema.nullable(),
  trendsGeo: z.string(),
});

export const setTrendsGeoInputSchema = z.object({ geo: z.string().regex(/^[A-Z]{2}$/) });

export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisView = z.infer<typeof analysisViewSchema>;
export type CaptureIdInput = z.infer<typeof captureIdInputSchema>;
export type CapturedAnalysis = z.infer<typeof capturedAnalysisSchema>;
export type LlmAnalysis = z.infer<typeof llmAnalysisSchema>;
export type SetTrendsGeoInput = z.infer<typeof setTrendsGeoInputSchema>;
