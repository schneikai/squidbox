import { channelName } from '@squidbox/shared';

import channelsText from './channelsText';
import isAllChannels from './isAllChannels';

const ALL_CHANNELS = 'All channels';

/**
 * A version's name on its chip, from its channels in bar order (the caller's orderChannelIds):
 * `label` the compact text the chip shows ("Bluesky, X"), `accessibilityLabel` what VoiceOver reads,
 * a sentence like every other list of channels the app speaks ("Bluesky and X", channelsText). All
 * channels when it goes to every one of the user's channels (`userChannelIds`, two or more: isAllChannels);
 * No channel for none.
 */
export default function versionLabel(
  orderedChannelIds: readonly string[],
  userChannelIds: readonly string[],
): {
  label: string;
  accessibilityLabel: string;
} {
  if (orderedChannelIds.length === 0) return { label: channelName(null), accessibilityLabel: channelName(null) };
  if (isAllChannels(orderedChannelIds, userChannelIds))
    return { label: ALL_CHANNELS, accessibilityLabel: ALL_CHANNELS };
  return { label: orderedChannelIds.map(channelName).join(', '), accessibilityLabel: channelsText(orderedChannelIds) };
}
