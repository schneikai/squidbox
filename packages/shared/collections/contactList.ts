import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';

export const CONTACT_LIST_LIMITS = { name: 200, notes: 5000 } as const;

// `contact_lists` — named groups of contacts (Contacts → Lists). Membership lives in the
// `contact_list_members` edge collection. Lists are shown by name. Deletion is a `deletedAt` tombstone.
// `pinnedAt`: when the list was pinned to the top of Contacts in place of Favorites (null when it
// isn't). One list is pinned at a time, the latest; optional, so a record from before it reads as
// not pinned.
export const contactListCollection = defineCollection({
  name: 'contact_lists',
  schema: baseRecordSchema.extend({
    name: textSchema.min(1).max(CONTACT_LIST_LIMITS.name),
    notes: textSchema.max(CONTACT_LIST_LIMITS.notes).nullable(),
    pinnedAt: timestampSchema.nullable().optional(),
  }),
});

export type ContactListRecord = z.infer<typeof contactListCollection.schema>;
