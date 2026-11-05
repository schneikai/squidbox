import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';

export const CONTACT_LIMITS = { name: 200, handle: 200, phoneNumber: 50, notes: 5000, places: 20, place: 200 } as const;

const handleSchema = textSchema.max(CONTACT_LIMITS.handle).nullable();

/**
 * The networks a contact has a handle on, in the order the app shows them: the field, the network's
 * name, a hint of the form a handle takes, the hosts a profile URL is pasted from (without scheme or
 * `www.`) and the web profile a handle opens. Everything that lists the handles derives from this.
 */
export const CONTACT_HANDLES = [
  {
    field: 'xHandle',
    label: 'X',
    placeholder: 'x.com/username',
    hosts: ['x.com/', 'twitter.com/'],
    profileUrl: (handle: string) => `https://x.com/${handle}`,
  },
  {
    field: 'blueskyHandle',
    label: 'Bluesky',
    placeholder: 'name.bsky.social',
    hosts: ['bsky.app/profile/'],
    profileUrl: (handle: string) => `https://bsky.app/profile/${handle}`,
  },
  {
    field: 'onlyFansHandle',
    label: 'OnlyFans',
    placeholder: 'onlyfans.com/username',
    hosts: ['onlyfans.com/'],
    profileUrl: (handle: string) => `https://onlyfans.com/${handle}`,
  },
  {
    field: 'jffHandle',
    label: 'JFF',
    placeholder: 'justfor.fans/username',
    hosts: ['justfor.fans/'],
    profileUrl: (handle: string) => `https://justfor.fans/${handle}`,
  },
] as const;
export type ContactHandleField = (typeof CONTACT_HANDLES)[number]['field'];
export const CONTACT_HANDLE_FIELDS: readonly ContactHandleField[] = CONTACT_HANDLES.map(({ field }) => field);

const handleSchemas = Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, handleSchema])) as Record<
  ContactHandleField,
  typeof handleSchema
>;

// `contacts` — the people the user works with (the Contacts tab). The handles are stored without
// `@` or a URL (normalizeHandle); `places` is a list of free-text places ("Squamish, Canada") that
// merges as one value. The avatar is a file in the user's storage (`avatar-<id>-<new id>.jpg`) that
// `avatarFilename` names, null without a photo: a file field, so the sync uploads the file before the
// record is pushed; a new photo gets a new name, so a device holding the old one never shows it for
// the new. Deletion is a `deletedAt` tombstone, which Restore undoes.
export const contactCollection = defineCollection({
  name: 'contacts',
  schema: baseRecordSchema.extend({
    name: textSchema.max(CONTACT_LIMITS.name),
    isFavorite: z.boolean(),
    favoritedAt: timestampSchema.nullable(),
    notes: textSchema.max(CONTACT_LIMITS.notes).nullable(),
    ...handleSchemas,
    phoneNumber: textSchema.max(CONTACT_LIMITS.phoneNumber).nullable(),
    places: z.array(textSchema.min(1).max(CONTACT_LIMITS.place)).max(CONTACT_LIMITS.places),
    avatarFilename: textSchema.nullable(),
  }),
  fieldGroups: [['isFavorite', 'favoritedAt']],
  fileFields: ['avatarFilename'],
});

export type ContactRecord = z.infer<typeof contactCollection.schema>;
