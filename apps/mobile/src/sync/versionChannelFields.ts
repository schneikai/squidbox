import type { PostRecord } from '@squidbox/shared';

/**
 * The stored channel fields of a version going to `channelIds` (sync-design §10): its first channel
 * is `channelId`, the rest `extraChannelIds`, null unless there are two or more (never [], so a
 * one-channel save of a row without extras writes nothing). Throws on a channel listed twice.
 */
export default function versionChannelFields(
  channelIds: readonly string[],
): Pick<PostRecord, 'channelId' | 'extraChannelIds'> {
  if (new Set(channelIds).size !== channelIds.length) {
    throw new Error(`A version lists a channel twice: ${channelIds.join(', ')}`);
  }
  return {
    channelId: channelIds[0] ?? null,
    extraChannelIds: channelIds.length > 1 ? channelIds.slice(1) : null,
  };
}
