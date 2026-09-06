export const MEDIA_TYPES = {
  // Value modernized 'image' → 'photo' (matches expo-media-library + the sync schema). Code
  // compares via MEDIA_TYPES.IMAGE, so this one change updates all those call sites.
  IMAGE: 'photo',
  VIDEO: 'video',
};
