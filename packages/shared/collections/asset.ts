import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// The `assets` collection — asset METADATA (binary files move via the S3 flow, not sync).
// Fields mapped from the app's yup schema (sync-design §10). The three is*Synced flags are
// GLOBAL "binary is in S3" facts and are therefore SYNCED (sync-design §4); only syncError is
// per-device local-only.
export const assetCollection = defineCollection({
  name: 'assets',
  schema: baseRecordSchema.extend({
    mediaLibraryAssetId: z.string(),
    mediaType: z.enum(['photo', 'video']),
    width: z.number(),
    height: z.number(),
    fileSize: z.number(),
    duration: z.number().nullable(),
    filename: z.string(),
    thumbnailFilename: z.string(),
    isFavorite: z.boolean(),
    notes: z.string().nullable(),
    // postHistory / lastPostedAt are derived on-device from posts + membership (not synced).
    oldFileId: z.string().nullable(),
    isFileSynced: z.boolean(),
    isThumbnailSynced: z.boolean(),
    isSynced: z.boolean(),
  }),
  localOnly: {
    syncError: z.string().nullable(),
  },
});

export type AssetRecord = z.infer<typeof assetCollection.schema>;
