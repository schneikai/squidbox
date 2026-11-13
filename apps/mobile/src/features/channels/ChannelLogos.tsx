import { channelName } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import ChannelLogo from './ChannelLogo';

import { sizes, space } from '@/styles/designTokens';
import joinWords from '@/utils/joinWords';

type ChannelLogosProps = { channelIds: readonly string[] };

/**
 * The channels a post is on, as a row of their plain logos in the order given (a post's card in a list):
 * a status, not a control. VoiceOver reads them as one, by name ("Bluesky and X"). A channel this build
 * doesn't know has no logo, only its name in that label. Nothing for an empty list.
 */
export default function ChannelLogos({ channelIds }: ChannelLogosProps) {
  if (channelIds.length === 0) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={joinWords(channelIds.map(channelName))}
      style={styles.row}
    >
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
});
