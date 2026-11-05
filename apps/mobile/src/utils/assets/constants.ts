import type { AssetRecord } from '@squidbox/shared';

export const MEDIA_TYPES = {
  IMAGE: 'photo',
  VIDEO: 'video',
} as const satisfies Record<string, AssetRecord['mediaType']>;
