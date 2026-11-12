import type { AssetRecord } from '@squidbox/shared';

export const MEDIA_TYPES = {
  IMAGE: 'photo',
  VIDEO: 'video',
} as const satisfies Record<string, AssetRecord['mediaType']>;

// How long an asset's download (withAssetFileAsync) is reused after its last use, before
// deleteStaleDownloadsAsync removes it: sharing the same asset again within a day doesn't download it again.
export const KEEP_DOWNLOADS_FOR = 24 * 60 * 60 * 1000; // ms
