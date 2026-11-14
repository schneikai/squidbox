import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii, scale } from '@/styles/designTokens';

const SIZE = { list: scale(26), media: 22 };

/** The circle's size on a list, for a slot that lines up with it (Row's check for a pick-one row). */
export const LIST_INDICATOR_SIZE = SIZE.list;

export type SelectIndicatorProps = {
  isSelected?: boolean | 'mixed';
  isOnMedia?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The pick-several selection mark: a check on a filled circle (colors.selection) when selected, a dash
// on it when `mixed` (picked for some of several, as a contact on some of an album's photos), an empty
// ring when not. `isOnMedia` (over a picture, a little smaller) the ring is white, and a selected
// circle keeps it around its fill so it shows on a dark photo; on a list the ring is a thin grey one.
// The parent positions it through `style`.
export default function SelectIndicator({ isSelected, isOnMedia = false, style }: SelectIndicatorProps) {
  const size = SIZE[isOnMedia ? 'media' : 'list'];
  const box = { width: size, height: size };

  if (isSelected) {
    return (
      <View style={[styles.circle, styles.filled, box, isOnMedia && styles.onMedia, style]}>
        <Icon
          name={isSelected === 'mixed' ? 'minus' : 'check'}
          size={Math.round(size * 0.62)}
          color={colors.selection.onMark}
        />
      </View>
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
  filled: {
    backgroundColor: colors.selection.mark,
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
