import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

export const CONTACT_LINK_TARGETS = ['asset', 'album', 'post'] as const;

// `contact_links` — an edge collection: a contact on a photo (its Contacts section); an album or
// post lists the contacts on its photos. Read by (targetType, targetId) and by contactId. Removal is
// a tombstone; adding again restores it. A link to a deleted item stays and is hidden with it.
// The app writes `asset` only; `album` and `post` stay valid for what older builds wrote.
export const contactLinkCollection = defineCollection({
  name: 'contact_links',
  schema: baseRecordSchema.extend({
    contactId: z.uuid(),
    targetType: z.enum(CONTACT_LINK_TARGETS),
    targetId: z.uuid(),
  }),
});

export type ContactLinkRecord = z.infer<typeof contactLinkCollection.schema>;
