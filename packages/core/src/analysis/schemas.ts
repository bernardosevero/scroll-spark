import { z } from "zod";

import { captureSchema } from "../capture/schemas";

const line = z.string().trim().min(1);

/** What the model must return. It's parsed here, because model output is never trusted. */
export const llmAnalysisSchema = z.object({
  summary: line,
  topic: line,
  /** One line on how this user could take the topic. */
  angle: line,
  /** Each 1 to 3 common words, since specific phrases come back empty on Google Trends. */
  trendPhrases: z.array(line).min(1).max(3),
});

export const analysisSchema = llmAnalysisSchema.extend({
  captureId: z.string(),
  model: z.string(),
  createdAt: z.iso.datetime(),
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
