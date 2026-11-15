import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

/** When a copy was sent, as its card and its screen say it ("Sent 2 days ago"). */
export default function copySentText(sentAt: number): string {
  return `Sent ${dateToTimeAgo(sentAt)}`;
}
