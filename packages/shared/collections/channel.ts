import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// `channels` — the user's channels (Settings → Posts → Channels), in their order: one record per
// built-in channel (channels.ts), under the catalog's fixed `recordId`, so two devices adding the same
// channel write one record and adding a deleted one again revives it. `channelId` is the catalog id,
// free text so a build keeps syncing a channel a newer build added; `position` is a fractional-index
// key ordering them, by `(position, id)`. Deletion is a tombstone.
export const channelCollection = defineCollection({
  name: 'channels',
  schema: baseRecordSchema.extend({
    channelId: textSchema.min(1).max(40),
    position: textSchema,
  }),
});

export type ChannelRecord = z.infer<typeof channelCollection.schema>;
