// Contacts wire contract: what the server reads for a New contact (an X profile for From link, a
// screenshot for From screenshot, contracts/ai.ts).
import { z } from 'zod';
import { CONTACT_HANDLE_FIELDS, type ContactHandleField, X_HANDLE_PATTERN } from '../collections/contact';
import { imageSchema } from './image';

// A contact as the server reads it from a profile: the name, the handles (bare, case kept) and the
// place's parts, each empty when the profile doesn't show it.
export const contactReadSchema = z.object({
  name: z.string(),
  ...(Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, z.string()])) as Record<
    ContactHandleField,
    z.ZodString
  >),
  city: z.string(),
  state: z.string(),
  country: z.string(),
});
export type ContactRead = z.infer<typeof contactReadSchema>;

/** A reading that found nothing: every field empty. */
export function emptyContactRead(): ContactRead {
  return Object.fromEntries(contactReadSchema.keyof().options.map((field) => [field, ''])) as ContactRead;
}

// POST /ai/contact-from-link — From link on a New contact, an assistant feature: the X handle of a
// profile link. Only X links for now.
export const contactFromLinkRequestSchema = z.object({
  handle: z.string().regex(new RegExp(`^${X_HANDLE_PATTERN.source}$`), 'an X handle'),
});
export type ContactFromLinkRequest = z.infer<typeof contactFromLinkRequestSchema>;

// What x.com showed: `found` a profile (a protected one too: X shows its name, bio, place and photo);
// `unavailable` a profile X hides from signed-out readers; `notFound` no such handle; `failed` a page
// the server couldn't fetch or read.
const xProfileStatusSchema = z.enum(['found', 'unavailable', 'notFound', 'failed']);

// Its answer: `contact` what the user's writing model read in the profile, as From screenshot's
// read (the X handle always the link's); nothing but the X handle unless `found`. `avatar` the
// profile photo the server downloaded, null without one.
export const contactFromLinkResponseSchema = z.object({
  status: xProfileStatusSchema,
  contact: contactReadSchema,
  avatar: imageSchema.nullable(),
});
export type ContactFromLinkResponse = z.infer<typeof contactFromLinkResponseSchema>;
