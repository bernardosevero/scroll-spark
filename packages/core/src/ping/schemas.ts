import { z } from "zod";

export const pingInputSchema = z.object({
  name: z.string(),
});

export const pingOutputSchema = z.object({
  message: z.string(),
  answeredAt: z.iso.datetime(),
});

export type PingInput = z.infer<typeof pingInputSchema>;
export type PingOutput = z.infer<typeof pingOutputSchema>;
