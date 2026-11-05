import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

export const CONTACT_LINK_TARGETS = ['asset', 'album', 'post'] as const;

// `contact_links` — an edge collection: a contact on a photo, album or post (its Contacts section).
// One collection for the three targets, read by (targetType, targetId) and by contactId. Removal is
// a tombstone; adding again restores it. A link to a deleted item stays and is hidden with it.
export const contactLinkCollection = defineCollection({
  name: 'contact_links',
  schema: baseRecordSchema.extend({
    contactId: z.string().uuid(),
    targetType: z.enum(CONTACT_LINK_TARGETS),
    targetId: z.string().uuid(),
  }),
});

export type ContactLinkRecord = z.infer<typeof contactLinkCollection.schema>;
