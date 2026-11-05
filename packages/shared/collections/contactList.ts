import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const CONTACT_LIST_LIMITS = { name: 200, notes: 5000 } as const;

// `contact_lists` — named groups of contacts (Contacts → Lists). Membership lives in the
// `contact_list_members` edge collection. `position` is kept for a later custom order (a
// fractional-index key) and not written yet: lists are shown by name. Deletion is a `deletedAt` tombstone.
export const contactListCollection = defineCollection({
  name: 'contact_lists',
  schema: baseRecordSchema.extend({
    name: textSchema.min(1).max(CONTACT_LIST_LIMITS.name),
    notes: textSchema.max(CONTACT_LIST_LIMITS.notes).nullable(),
    position: textSchema.nullable(),
  }),
});

export type ContactListRecord = z.infer<typeof contactListCollection.schema>;
