import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `contact_list_members` — an edge collection: one record per (list, contact) membership, so adding
// and removing on two devices compose under the per-field LWW instead of clobbering a list's array.
// A list shows its contacts by name. Removal is a tombstone; adding again restores it. Two offline
// adds of one contact leave two live edges, which reads count once.
export const contactListMemberCollection = defineCollection({
  name: 'contact_list_members',
  schema: baseRecordSchema.extend({
    listId: z.string().uuid(),
    contactId: z.string().uuid(),
  }),
});

export type ContactListMemberRecord = z.infer<typeof contactListMemberCollection.schema>;
