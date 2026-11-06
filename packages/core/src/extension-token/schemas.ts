import { z } from "zod";

/** A connection the user can see and revoke. It never carries the token itself. */
export const extensionTokenSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

/** What connecting returns. This is the only time the token itself is ever shown. */
export const connectedTokenSchema = extensionTokenSchema.extend({ token: z.string() });

export const revokeTokenInputSchema = z.object({ tokenId: z.uuid() });

export type ExtensionToken = z.infer<typeof extensionTokenSchema>;
export type ConnectedToken = z.infer<typeof connectedTokenSchema>;
export type RevokeTokenInput = z.infer<typeof revokeTokenInputSchema>;
