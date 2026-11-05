import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import { colors, radii, scale } from '@/styles/designTokens';

const SIZE = { list: scale(26), media: 22 };

export type SelectIndicatorProps = { isSelected?: boolean; isOnMedia?: boolean; style?: StyleProp<ViewStyle> };

// A selection circle: a check on the accent's gradient when selected, an empty ring when not. The
// ring is white `isOnMedia` (over a picture, a little smaller) and a thin grey one on a list. The
// parent positions it through `style`.
export default function SelectIndicator({ isSelected, isOnMedia = false, style }: SelectIndicatorProps) {
  const size = SIZE[isOnMedia ? 'media' : 'list'];
  const box = { width: size, height: size };

  if (isSelected) {
    return (
      <GradientFill style={[styles.circle, box, style]}>
        <Icon name="check" size={Math.round(size * 0.62)} color={colors.text.inverse} />
      </GradientFill>
    );
  }
  return <View style={[styles.circle, box, isOnMedia ? styles.onMedia : styles.onList, style]} />;
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onList: {
    borderWidth: 1.5,
    borderColor: colors.background.placeholder,
  },
  onMedia: {
    borderWidth: 2,
    borderColor: colors.text.inverse,
  },
});
