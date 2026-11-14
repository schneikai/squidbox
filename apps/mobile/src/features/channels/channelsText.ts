import { channelName } from '@squidbox/shared';

import joinWords from '@/utils/joinWords';

/** Channels by name as a sentence lists them, for VoiceOver: "Bluesky", "Bluesky and X". */
export default function channelsText(channelIds: readonly string[]): string {
  return joinWords(channelIds.map(channelName));
}
