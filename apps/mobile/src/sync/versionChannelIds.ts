import type { PostRecord } from '@squidbox/shared';

/** A version's channels as stored (sync-design §10). */
export type StoredChannels = Pick<PostRecord, 'channelId' | 'extraChannelIds'>;

/**
 * The read rule for a version's channels (sync-design §10), from the stored fields of a post's
 * versions in read order (the post, then its other versions in id order): each version's
 * `channelId` first (kept always; none for null, extras included), then its `extraChannelIds`
 * without one that is any version's `channelId` or an earlier one. An installed build doesn't know
 * the extras: its "Change X to" or "Add channel X" can give another version a channel that is
 * already an extra, and that version keeps it. One version alone (a list's row) gets its own
 * channels, each once. versionChannelFields writes them back.
 */
export default function versionChannelIds(versions: readonly StoredChannels[]): string[][] {
  const taken = new Set(versions.flatMap((version) => (version.channelId ? [version.channelId] : [])));
  return versions.map(({ channelId, extraChannelIds }) => {
    if (!channelId) return [];
    const channelIds = [channelId];
    for (const id of extraChannelIds ?? []) {
      if (taken.has(id)) continue;
      taken.add(id);
      channelIds.push(id);
    }
    return channelIds;
  });
}
