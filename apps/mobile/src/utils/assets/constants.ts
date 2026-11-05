export const MEDIA_TYPES = {
  IMAGE: 'photo',
  VIDEO: 'video',
} as const;

export type AssetMediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];
