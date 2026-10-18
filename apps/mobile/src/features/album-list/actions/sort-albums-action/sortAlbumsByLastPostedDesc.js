// Albums by when they were last posted, newest first, the never posted (`lastPostedAt` null) last.
export default function sortAlbumsByLastPostedDesc(a, b) {
  if (a.lastPostedAt === b.lastPostedAt) return 0;
  if (a.lastPostedAt === null) return 1;
  if (b.lastPostedAt === null) return -1;
  return b.lastPostedAt - a.lastPostedAt;
}
