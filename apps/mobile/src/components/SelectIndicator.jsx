import { StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii } from '@/styles/designTokens';

const SIZE = 22;

// A selection circle: a check on an accent disc when selected, an empty ring when not. The ring is
// white `isOnMedia` (over a picture) and grey on a list. The parent positions it through `style`.
export default function SelectIndicator({ isSelected, isOnMedia = false, style }) {
  return (
    <View style={[styles.circle, isOnMedia && styles.onMedia, isSelected && styles.selected, style]}>
      {isSelected && <Icon name="check" size={15} color={colors.text.inverse} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.background.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onMedia: {
    borderColor: colors.text.inverse,
  },
  selected: {
    backgroundColor: colors.accent.base,
    borderColor: colors.accent.base,
  },
});
