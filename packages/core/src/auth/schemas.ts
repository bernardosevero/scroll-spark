import { z } from "zod";

export const tokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.date(),
});

export type TokenSet = z.infer<typeof tokenSetSchema>;

/** Held in an encrypted cookie between leaving for Buffer and coming back. */
export const pendingConnectSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
});

export type PendingConnect = z.infer<typeof pendingConnectSchema>;
