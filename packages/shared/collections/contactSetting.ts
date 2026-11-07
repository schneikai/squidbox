import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';

// `contact_settings` — how the user set up their contacts, beyond the contacts and lists: the
// built-in list pinned to the top of Contacts in place of Favorites (`pinnedListId`, a built-in
// list's id such as `tagged`; a list of the user's is pinned on its own record, contact_lists'
// `pinnedAt`), and when (`pinnedAt`), so the latest pin of either kind shows. One record per user,
// whose id is the user's id, like `personas`, so every device writes the same record.
export const contactSettingCollection = defineCollection({
  name: 'contact_settings',
  schema: baseRecordSchema.extend({
    pinnedListId: textSchema.max(40).nullable(),
    pinnedAt: timestampSchema.nullable(),
  }),
  fieldGroups: [['pinnedListId', 'pinnedAt']],
});

export type ContactSettingRecord = z.infer<typeof contactSettingCollection.schema>;
