import { z } from "zod";

/** Source links are rendered as links, so anything but the web, like `javascript:`, stays out. */
const webUrlSchema = z.url({ protocol: /^https?$/ });

const capturePlatformSchema = z.enum(["pasted", "linkedin", "youtube", "web", "example"]);

const sourceNameSchema = z.string().trim().min(1).max(200).nullable();

export const createCaptureInputSchema = z.object({
  // Longer text is cut by the service. This only refuses what nobody would paste by accident.
  text: z.string().trim().min(1).max(50_000),
  sourceUrl: webUrlSchema.nullable(),
  platform: capturePlatformSchema,
  sourceName: sourceNameSchema,
});

export const captureSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceUrl: webUrlSchema.nullable(),
  platform: capturePlatformSchema,
  sourceName: sourceNameSchema,
  createdAt: z.iso.datetime(),
});

export const inboxSchema = z.array(captureSchema);

export const readLinkInputSchema = z.object({ url: webUrlSchema });

export const readLinkResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("found"),
    url: webUrlSchema,
    platform: capturePlatformSchema,
    text: z.string(),
    sourceName: sourceNameSchema,
  }),
  z.object({
    status: z.literal("paste_needed"),
    url: webUrlSchema,
    platform: capturePlatformSchema,
  }),
]);

export type Capture = z.infer<typeof captureSchema>;
export type CapturePlatform = z.infer<typeof capturePlatformSchema>;
export type CreateCaptureInput = z.infer<typeof createCaptureInputSchema>;
export type ReadLinkInput = z.infer<typeof readLinkInputSchema>;
export type ReadLinkResult = z.infer<typeof readLinkResultSchema>;
