import sortAlbumsByCustomOrder from './sortAlbumsByCustomOrder';
import sortAlbumsByLastPostedDesc from './sortAlbumsByLastPostedDesc';

// The albums list's compare functions, by sort order key.
export default {
  custom: sortAlbumsByCustomOrder,
  'name:asc': (a, b) => a.name.localeCompare(b.name),
  'name:desc': (a, b) => b.name.localeCompare(a.name),
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
  'lastPostedAt:asc': (a, b) => {
    if (a.lastPostedAt === null && b.lastPostedAt === null) return 0;
    if (a.lastPostedAt === null) return -1;
    if (b.lastPostedAt === null) return 1;
    return a.lastPostedAt - b.lastPostedAt;
  },
  'lastPostedAt:desc': sortAlbumsByLastPostedDesc,
};
