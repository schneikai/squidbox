import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import { colors, radii, scale, typography } from '@/styles/designTokens';

const CIRCLE_SIZE = scale(24);

// A model to tick for a compare: a check on an accent disc when ticked, an empty ring when not,
// and "Current" on the chosen one.
export default function ModelPickRow({ name, isTicked, isCurrent, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      activeOpacity={0.6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isTicked }}
    >
      <View style={[styles.circle, isTicked ? styles.ticked : styles.unticked]}>
        {isTicked && <Icon name="check" size={scale(14)} color={colors.text.inverse} />}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {isCurrent && <Text style={styles.current}>Current</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticked: {
    backgroundColor: colors.accent.base,
  },
  unticked: {
    borderWidth: 2,
    borderColor: colors.background.placeholder,
  },
  name: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  current: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
});
