import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';

export const CONTACT_LIMITS = { name: 200, handle: 200, phoneNumber: 50, notes: 5000, places: 20, place: 200 } as const;

const handleSchema = textSchema.max(CONTACT_LIMITS.handle).nullable();

// `contacts` — the people the user works with (the Contacts tab). The handles are stored without
// `@` or a URL (normalizeHandle); `places` is a list of free-text places ("Squamish, Canada") that
// merges as one value. The avatar is a file in the user's storage (`avatar-<id>-<n>.jpg`):
// `avatarFilename` names it, null without a photo, and `isAvatarSynced` says it was uploaded, so
// both change together. Deletion is a `deletedAt` tombstone, which Restore undoes.
export const contactCollection = defineCollection({
  name: 'contacts',
  schema: baseRecordSchema.extend({
    name: textSchema.max(CONTACT_LIMITS.name),
    isFavorite: z.boolean(),
    favoritedAt: timestampSchema.nullable(),
    notes: textSchema.max(CONTACT_LIMITS.notes).nullable(),
    xHandle: handleSchema,
    blueskyHandle: handleSchema,
    onlyFansHandle: handleSchema,
    jffHandle: handleSchema,
    phoneNumber: textSchema.max(CONTACT_LIMITS.phoneNumber).nullable(),
    places: z.array(textSchema.min(1).max(CONTACT_LIMITS.place)).max(CONTACT_LIMITS.places),
    avatarFilename: textSchema.nullable(),
    isAvatarSynced: z.boolean(),
  }),
  fieldGroups: [
    ['isFavorite', 'favoritedAt'],
    ['avatarFilename', 'isAvatarSynced'],
  ],
});

export type ContactRecord = z.infer<typeof contactCollection.schema>;
