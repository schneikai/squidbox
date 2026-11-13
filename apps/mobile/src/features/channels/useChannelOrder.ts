import type { Channel } from '@squidbox/shared';
import { useMemo } from 'react';

/**
 * The ids of the user's `channels` (useChannels) in their order; empty while they are read. Stable
 * until the channels change, so it can go to memoized rows.
 */
export default function useChannelOrder(channels: Channel[] | undefined): string[] {
  return useMemo(() => (channels ?? []).map((channel) => channel.id), [channels]);
}
