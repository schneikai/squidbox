import WarningNote, { type WarningNoteProps } from '@/components/WarningNote';

type NoThreadsNoteProps = {
  /** How many posts the thread has: the note shows only for more than one. */
  postCount: number;
  channel: { hasThreads: boolean } | undefined;
  style?: WarningNoteProps['style'];
};

/**
 * The warning on a channel copy (its card, its composer) of a thread for a channel without threads:
 * its posts go out as one (payloadText). Nothing for one post or a channel with threads. style is
 * for layout only.
 */
export default function NoThreadsNote({ postCount, channel, style }: NoThreadsNoteProps) {
  if (!channel || channel.hasThreads || postCount < 2) return null;

  return <WarningNote style={style}>No threads. Sending as one post.</WarningNote>;
}
