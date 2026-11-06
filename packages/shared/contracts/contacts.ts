// Contacts wire contract: what the server reads for a New contact (an X profile for From link, a
// screenshot for From screenshot, contracts/ai.ts).
import { z } from 'zod';
import { CONTACT_HANDLE_FIELDS, type ContactHandleField } from '../collections/contact';
import { imageSchema } from './image';

// A contact as the server reads it from a profile: the name, the handles (normalized,
// normalizeHandle) and the place's parts, each empty when the profile doesn't show it.
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

// The characters of an X handle (older handles can be longer than 15), without anchors.
export const X_HANDLE_PATTERN = /[A-Za-z0-9_]{1,50}/;

// POST /contacts/x-profile — the X handle of a profile link.
export const contactFromXProfileRequestSchema = z.object({
  handle: z.string().regex(new RegExp(`^${X_HANDLE_PATTERN.source}$`), 'an X handle'),
});
export type ContactFromXProfileRequest = z.infer<typeof contactFromXProfileRequestSchema>;

// What x.com showed: `found` a profile with its fields (a protected one too: X shows its name, bio,
// place and photo); `unavailable` a profile X hides from signed-out readers; `notFound` no such
// handle; `failed` a page the server couldn't fetch or read. The last three carry empty fields.
export const X_PROFILE_STATUSES = ['found', 'unavailable', 'notFound', 'failed'] as const;
export const xProfileStatusSchema = z.enum(X_PROFILE_STATUSES);
export type XProfileStatus = z.infer<typeof xProfileStatusSchema>;

// Its answer, for every account, without the assistant (POST /ai/contact-from-x-profile is its
// pass): `xHandle` is the request's handle normalized; the handles the bio, website and Bluesky
// profile name; `city` the location as X shows it; `bio` with its t.co links expanded; `website`
// the profile's link; `avatar` the 400 px profile photo (or the Bluesky one), null without one.
export const contactFromXProfileResponseSchema = contactReadSchema.extend({
  status: xProfileStatusSchema,
  bio: z.string(),
  website: z.string(),
  avatar: imageSchema.nullable(),
});
export type ContactFromXProfileResponse = z.infer<typeof contactFromXProfileResponseSchema>;
