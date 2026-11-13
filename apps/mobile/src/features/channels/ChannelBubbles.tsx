import { channelById } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import ChannelLogo from './ChannelLogo';
import channelName from './channelName';

import Bubble from '@/components/Bubble';
import { space } from '@/styles/designTokens';
import joinWords from '@/utils/joinWords';

type ChannelBubblesProps = { channelIds: readonly string[] };

/**
 * The channels a post is on, as a row of their logos' bubbles in the order given (a post's card in a
 * list), spaced as the channel bar's: VoiceOver reads them as one, by name ("Bluesky and X"). A channel
 * this build doesn't know shows its id. Nothing for an empty list.
 */
export default function ChannelBubbles({ channelIds }: ChannelBubblesProps) {
  if (channelIds.length === 0) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={joinWords(channelIds.map(channelName))}
      style={styles.row}
    >
      {channelIds.map((channelId) => (
        <Bubble
          key={channelId}
          label={channelName(channelId)}
          mark={channelById(channelId) && <ChannelLogo channelId={channelId} />}
          isGrouped
        />
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
