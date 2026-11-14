import { channelName } from '@squidbox/shared';

import channelsText from './channelsText';

/**
 * A version's name on its chip, from its channels in bar order (the caller's orderChannelIds):
 * `label` the compact text the chip shows ("Bluesky, X"), `accessibilityLabel` what VoiceOver reads,
 * a sentence like every other list of channels the app speaks ("Bluesky and X", channelsText). No
 * channel for none.
 */
export default function versionLabel(orderedChannelIds: readonly string[]): {
  label: string;
  accessibilityLabel: string;
} {
  if (orderedChannelIds.length === 0) return { label: channelName(null), accessibilityLabel: channelName(null) };
  return { label: orderedChannelIds.map(channelName).join(', '), accessibilityLabel: channelsText(orderedChannelIds) };
}
