import WarningNote, { type WarningNoteProps } from '@/components/WarningNote';

type NoThreadsNoteProps = {
  /** How many posts the thread has: the note shows only for more than one. */
  postCount: number;
  channel: { hasThreads: boolean } | undefined;
  style?: WarningNoteProps['style'];
};

/**
 * The warning in the composer of a channel copy that holds a thread for a channel without threads:
 * only its first post goes out (postsSentTo). Nothing for one post or a channel with threads. style is
 * for layout only.
 */
export default function NoThreadsNote({ postCount, channel, style }: NoThreadsNoteProps) {
  if (!channel || channel.hasThreads || postCount < 2) return null;

  return <WarningNote style={style}>No threads. Only the first post is sent.</WarningNote>;
}
