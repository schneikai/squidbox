// A picture on the wire, as base64 with its media type: a photo the app sends the assistant, a
// profile photo the server brings back.
import { z } from 'zod';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const imageSchema = z.object({ base64: z.string(), mimeType: z.enum(IMAGE_MIME_TYPES) });
export type WireImage = z.infer<typeof imageSchema>;

/** A picture as the `data:` URL an image source or a vision message takes. */
export function imageDataUrl({ base64, mimeType }: { base64: string; mimeType: string }): string {
  return `data:${mimeType};base64,${base64}`;
}
