import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// The server's integer (int4) columns.
const int4Schema = z.number().int().min(-(2 ** 31)).max(2 ** 31 - 1);

// The `assets` collection — asset METADATA (binary files move via the S3 flow, not sync).
// Fields mapped from the app's yup schema (sync-design §10). The three is*Synced flags are
// GLOBAL "binary is in S3" facts and are therefore SYNCED (sync-design §4); only syncError is
// per-device local-only.
export const assetCollection = defineCollection({
  name: 'assets',
  schema: baseRecordSchema.extend({
    mediaLibraryAssetId: textSchema,
    mediaType: z.enum(['photo', 'video']),
    width: int4Schema,
    height: int4Schema,
    fileSize: z.number().int().safe(),
    duration: z.number().nullable(),
    filename: textSchema,
    thumbnailFilename: textSchema,
    isFavorite: z.boolean(),
    notes: textSchema.nullable(),
    // postHistory / lastPostedAt are derived on-device from posts + membership (not synced).
    oldFileId: textSchema.nullable(),
    isFileSynced: z.boolean(),
    isThumbnailSynced: z.boolean(),
    isSynced: z.boolean(),
  }),
  localOnly: {
    syncError: z.string().nullable(),
  },
});

export type AssetRecord = z.infer<typeof assetCollection.schema>;
