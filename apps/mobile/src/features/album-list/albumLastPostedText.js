import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

// When an albumQuery row was last posted, e.g. "Posted 4 days ago".
export default function albumLastPostedText(album) {
  return album.lastPostedAt ? `Posted ${dateToTimeAgo(album.lastPostedAt)}` : 'Never posted';
}
