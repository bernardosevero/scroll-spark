import { z } from "zod";

export const accountStatusSchema = z.object({
  /** True when the Buffer connection needs the user to connect again. */
  needsReconnect: z.boolean(),
});

export type AccountStatus = z.infer<typeof accountStatusSchema>;
