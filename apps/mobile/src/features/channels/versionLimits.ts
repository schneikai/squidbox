import { channelById, type Channel } from '@squidbox/shared';

/**
 * A version's limits, the strictest of its channels': `maxTextLength` and `maxMedia` the smallest
 * (null when none has one), `textLimitOf` and `mediaLimitOf` the name of the channel whose limit it
 * is (null for a version on one channel), `threadless` the names of its channels without threads.
 */
export type VersionLimits = Pick<Channel, 'maxTextLength' | 'maxMedia'> & {
  textLimitOf: string | null;
  mediaLimitOf: string | null;
  threadless: string[];
};

/** The limits of a version on `channelIds` (VersionLimits), from the ones this build knows; none when it knows none. */
export default function versionLimits(channelIds: readonly string[]): VersionLimits | undefined {
  const channels = channelIds.flatMap((id) => channelById(id) ?? []);
  if (channels.length === 0) return undefined;
  const strictest = (limit: (channel: Channel) => number | null) =>
    channels.reduce<Channel | undefined>((best, channel) => {
      const value = limit(channel);
      return value != null && (best === undefined || value < limit(best)!) ? channel : best;
    }, undefined);
  const byText = strictest((channel) => channel.maxTextLength);
  const byMedia = strictest((channel) => channel.maxMedia);
  return {
    maxTextLength: byText?.maxTextLength ?? null,
    maxMedia: byMedia?.maxMedia ?? null,
    textLimitOf: channelIds.length > 1 ? (byText?.name ?? null) : null,
    mediaLimitOf: channelIds.length > 1 ? (byMedia?.name ?? null) : null,
    threadless: channels.filter((channel) => !channel.hasThreads).map((channel) => channel.name),
  };
}
