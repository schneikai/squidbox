import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';

export const CONTACT_LIMITS = { name: 200, handle: 200, phoneNumber: 50, notes: 5000, places: 20, place: 200 } as const;

const handleSchema = textSchema.max(CONTACT_LIMITS.handle).nullable();

/** A place's parts, in the order a form shows them. */
export const CONTACT_PLACE_PARTS = ['city', 'state', 'country'] as const;
// A place: its city, state (optional: '' where none is given) and country, each trimmed, at least one
// of them set.
const placePartSchema = textSchema.max(CONTACT_LIMITS.place);
export const contactPlaceSchema = z
  .object({ city: placePartSchema, state: placePartSchema, country: placePartSchema })
  .refine((place) => CONTACT_PLACE_PARTS.some((part) => place[part] !== ''), 'a place with no part set');
export type ContactPlace = z.infer<typeof contactPlaceSchema>;
// A contact photo's name: a flat file name (`avatar-<contactId>-<id>.jpg`), never a path, since each
// device joins it into its avatars folder.
const avatarFilenameSchema = textSchema.regex(/^avatar-[A-Za-z0-9-]+\.jpg$/, 'an avatar-….jpg file name');

// The characters of an X handle (older handles can be longer than 15), without anchors.
export const X_HANDLE_PATTERN = /[A-Za-z0-9_]{1,50}/;

// A network without pages at the root of its profiles' path.
const NO_PAGES: ReadonlySet<string> = new Set();

/**
 * The networks a contact has a handle on, in the order the app shows them: the field, the network's
 * name, a hint of the form a handle takes, whether it is shown with `@` (`isAtHandle`: where the app
 * writes a handle itself), the hosts a profile URL is pasted from (without scheme or `www.`), the
 * web profile a handle opens, and how a profile link's first path segment reads as a handle
 * (`handleSegment`, group 1 the handle; `reserved`: the network's pages at the root, lowercased, that
 * are no profile). A handle is stored as typed, trimmed, and compared with handleKey. Everything that
 * lists the handles derives from this.
 */
export const CONTACT_HANDLES = [
  {
    field: 'xHandle',
    label: 'X',
    placeholder: '@username',
    isAtHandle: true,
    hosts: ['x.com/', 'twitter.com/', 'mobile.x.com/', 'mobile.twitter.com/'],
    profileUrl: (handle: string) => `https://x.com/${handle}`,
    handleSegment: new RegExp(`^(${X_HANDLE_PATTERN.source})$`),
    reserved: new Set([
      'home',
      'explore',
      'search',
      'notifications',
      'messages',
      'settings',
      'i',
      'intent',
      'share',
      'hashtag',
      'compose',
      'login',
      'signup',
      'logout',
      'tos',
      'privacy',
      'download',
      'jobs',
      'about',
    ]) as ReadonlySet<string>,
  },
  {
    field: 'instagramHandle',
    label: 'Instagram',
    placeholder: '@username',
    isAtHandle: true,
    hosts: ['instagram.com/', 'm.instagram.com/'],
    profileUrl: (handle: string) => `https://instagram.com/${handle}`,
    handleSegment: /^([A-Za-z0-9._]{1,30})$/,
    // `_u` is the app's link to a profile (`instagram.com/_u/maya`), no profile itself.
    reserved: new Set([
      'p',
      'reel',
      'reels',
      'explore',
      'stories',
      'accounts',
      'direct',
      'tv',
      '_u',
      'about',
      'legal',
      'web',
    ]) as ReadonlySet<string>,
  },
  {
    field: 'blueskyHandle',
    label: 'Bluesky',
    placeholder: '@username',
    isAtHandle: true,
    hosts: ['bsky.app/profile/'],
    profileUrl: (handle: string) => `https://bsky.app/profile/${handle}`,
    // A domain-style handle: a DID (`did:plc:…`) is no handle.
    handleSegment: /^([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)$/,
    reserved: NO_PAGES,
  },
  {
    field: 'onlyFansHandle',
    label: 'OnlyFans',
    placeholder: 'onlyfans.com/username',
    isAtHandle: false,
    hosts: ['onlyfans.com/'],
    profileUrl: (handle: string) => `https://onlyfans.com/${handle}`,
    // Not a number: `onlyfans.com/123456/maya` is a post.
    handleSegment: /^(?!\d+$)([A-Za-z0-9_.-]+)$/,
    reserved: new Set(['my']) as ReadonlySet<string>,
  },
  {
    field: 'jffHandle',
    label: 'JFF',
    placeholder: 'justfor.fans/username',
    isAtHandle: false,
    hosts: ['justfor.fans/'],
    profileUrl: (handle: string) => `https://justfor.fans/${handle}`,
    handleSegment: /^([A-Za-z0-9_.-]+)$/,
    reserved: NO_PAGES,
  },
] as const;
export type ContactHandleField = (typeof CONTACT_HANDLES)[number]['field'];
export const CONTACT_HANDLE_FIELDS: readonly ContactHandleField[] = CONTACT_HANDLES.map(({ field }) => field);
/** Each handle's entry of CONTACT_HANDLES, by its field. */
export const CONTACT_HANDLE_BY_FIELD = Object.fromEntries(CONTACT_HANDLES.map((handle) => [handle.field, handle])) as {
  [F in ContactHandleField]: Extract<(typeof CONTACT_HANDLES)[number], { field: F }>;
};

// Instagram's came after the others: optional, so a record from before it reads as without one.
const handleSchemas = Object.fromEntries(
  CONTACT_HANDLE_FIELDS.map((field) => [field, field === 'instagramHandle' ? handleSchema.optional() : handleSchema]),
) as Record<Exclude<ContactHandleField, 'instagramHandle'>, typeof handleSchema> & {
  instagramHandle: ReturnType<typeof handleSchema.optional>;
};

// `contacts` — the people the user works with (the Contacts tab). The handles are stored as typed,
// trimmed, and compared with handleKey; `places` is a list of `{ city, state, country }` (the state
// optional, an empty string without one) that merges as one value. The avatar is a file in the user's storage (`avatar-<id>-<new id>.jpg`) that
// `avatarFilename` names, null without a photo: a file field, so the sync uploads the file before the
// record is pushed; a new photo gets a new name, so a device holding the old one never shows it for
// the new. Deletion is a `deletedAt` tombstone, and tombstones its list memberships and links too.
export const contactCollection = defineCollection({
  name: 'contacts',
  schema: baseRecordSchema.extend({
    name: textSchema.min(1).max(CONTACT_LIMITS.name),
    isFavorite: z.boolean(),
    favoritedAt: timestampSchema.nullable(),
    notes: textSchema.max(CONTACT_LIMITS.notes).nullable(),
    ...handleSchemas,
    phoneNumber: textSchema.max(CONTACT_LIMITS.phoneNumber).nullable(),
    places: z.array(contactPlaceSchema).max(CONTACT_LIMITS.places),
    avatarFilename: avatarFilenameSchema.nullable(),
  }),
  fieldGroups: [['isFavorite', 'favoritedAt']],
  fileFields: ['avatarFilename'],
});

export type ContactRecord = z.infer<typeof contactCollection.schema>;
