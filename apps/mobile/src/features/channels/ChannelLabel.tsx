import { channelById } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import ChannelLogo from './ChannelLogo';

import Chip from '@/components/Chip';
import { colors, layout, sizes, space, textStyles } from '@/styles/designTokens';

export type ChannelLabelProps = { channelId: string; size?: 'regular' | 'small' };

/**
 * A channel's logo and name: as a chip (a post's card, a post in a list), or `size="small"` plain, the
 * name small, bold and grey (a row of a post's Other channels). Nothing for an id the catalog doesn't know.
 */
export default function ChannelLabel({ channelId, size = 'regular' }: ChannelLabelProps) {
  const channel = channelById(channelId);
  if (!channel) return null;
  if (size === 'small') {
    return (
      <View style={styles.small}>
        <ChannelLogo channelId={channel.id} size={sizes.menuIcon} />
        <Text style={styles.smallName} numberOfLines={1}>
          {channel.name}
        </Text>
      </View>
    );
  }
  return (
    <Chip label={channel.name} leading={<ChannelLogo channelId={channel.id} size={sizes.menuIcon} />} isLeadingInset />
  );
}

const styles = StyleSheet.create({
  small: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap - space.xs,
  },
  smallName: {
    ...textStyles.footnoteBold,
    color: colors.text.secondary,
  },
});
