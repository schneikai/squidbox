import isOneOf from '@/lib/isOneOf';

// The albums list's sort order keys (albumSortFunctions, albumSortOptions).
const ALBUM_SORTS = ['custom', 'createdAt:asc', 'createdAt:desc', 'lastPostedAt:asc', 'lastPostedAt:desc'] as const;

export type AlbumSort = (typeof ALBUM_SORTS)[number];

/** Whether a stored sort key (AppSettings.albumListSortOrder) is one the albums list offers. */
export default isOneOf(ALBUM_SORTS);
