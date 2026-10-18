import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

// readLastPosted's result as a suggestion's two lines: when the asset was last posted, over when its
// album was.
export default function lastPostedText({ lastPostedAt, album }) {
  return {
    title: lastPostedAt ? `Last posted ${dateToTimeAgo(lastPostedAt)}` : 'Never posted',
    subtitle: albumLine(album),
  };
}

function albumLine(album) {
  if (!album) return 'Not in an album';
  const posted = album.lastPostedAt ? `last posted ${dateToTimeAgo(album.lastPostedAt)}` : 'never posted';
  return `Album “${album.name}” ${posted}`;
}
