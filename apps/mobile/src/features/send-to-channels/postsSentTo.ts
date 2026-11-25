import type { Channel } from '@squidbox/shared';

/**
 * The posts of a copy that go out to `channel`: all of them where it has threads, only the first
 * where it has none (its following posts stay in the copy, to edit or remove).
 */
export default function postsSentTo<T>(channel: Pick<Channel, 'hasThreads'>, posts: readonly T[]): T[] {
  return channel.hasThreads ? [...posts] : posts.slice(0, 1);
}
