import sortAlbumsByCustomOrder from './sortAlbumsByCustomOrder';
import sortAlbumsByLastPostedDesc from './sortAlbumsByLastPostedDesc';

import type { AlbumListRow } from '@/features/album-list/albumQuery';
import isOneOf from '@/lib/isOneOf';

const ALBUM_SORTS = ['custom', 'createdAt:asc', 'createdAt:desc', 'lastPostedAt:asc', 'lastPostedAt:desc'] as const;

export type AlbumSort = (typeof ALBUM_SORTS)[number];

export const isAlbumSort = isOneOf(ALBUM_SORTS);

type SortableAlbum = Pick<AlbumListRow, 'id' | 'position' | 'createdAt' | 'lastPostedAt'>;
type AlbumCompare = (a: SortableAlbum, b: SortableAlbum) => number;

// The albums list's compare functions, by sort order key.
export default {
  custom: sortAlbumsByCustomOrder,
  'createdAt:asc': (a, b) => {
    if (a.createdAt === null && b.createdAt === null) return 0;
    if (a.createdAt === null) return -1;
    if (b.createdAt === null) return 1;
    return a.createdAt - b.createdAt;
  },
  'createdAt:desc': (a, b) => {
    if (a.createdAt === null && b.createdAt === null) return 0;
    if (a.createdAt === null) return 1;
    if (b.createdAt === null) return -1;
    return b.createdAt - a.createdAt;
  },
  // Not posted in a while: the never posted first, then the longest since posted.
  'lastPostedAt:asc': (a, b) => {
    if (a.lastPostedAt === null && b.lastPostedAt === null) return 0;
    if (a.lastPostedAt === null) return -1;
    if (b.lastPostedAt === null) return 1;
    return a.lastPostedAt - b.lastPostedAt;
  },
  'lastPostedAt:desc': sortAlbumsByLastPostedDesc,
} satisfies Record<AlbumSort, AlbumCompare>;
