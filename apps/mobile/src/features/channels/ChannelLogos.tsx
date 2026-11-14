import { StyleSheet, View } from 'react-native';

import ChannelLogo from './ChannelLogo';
import channelsText from './channelsText';

import { sizes, space } from '@/styles/designTokens';

type ChannelLogosProps = { channelIds: readonly string[]; isDecorative?: boolean };

/**
 * The channels a post is on, as a row of their plain logos in the order given (a post's card in a list):
 * a status, not a control. VoiceOver reads them as one, by name ("Bluesky and X"). A channel this build
 * doesn't know has no logo, only its name in that label. Nothing for an empty list. `isDecorative`
 * beside a label that already names them (a version's chip): hidden from VoiceOver, centred on the
 * label's line.
 */
export default function ChannelLogos({ channelIds, isDecorative = false }: ChannelLogosProps) {
  const a11y = isDecorative
    ? ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
        'aria-hidden': true,
      } as const)
    : ({
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel: channelsText(channelIds),
      } as const);

  if (channelIds.length === 0) return null;
  return (
    <View {...a11y} style={[styles.row, isDecorative && styles.centred]}>
      {channelIds.map((channelId) => (
        <ChannelLogo key={channelId} channelId={channelId} size={sizes.menuIcon} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: space.sm,
  },
  centred: {
    alignSelf: 'center',
  },
});
