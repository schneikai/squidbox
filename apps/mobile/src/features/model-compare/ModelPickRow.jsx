import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import SelectIndicator from '@/components/SelectIndicator';
import { SCREEN_PADDING } from '@/constants';
import { colors, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// A model to tick for a compare, with "Current" on the chosen one.
export default function ModelPickRow({ name, isTicked, isCurrent, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      activeOpacity={0.6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isTicked }}
    >
      <SelectIndicator isSelected={isTicked} />
      <Text style={[listTextStyles.title, styles.name]} numberOfLines={1}>
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
  name: {
    flex: 1,
  },
  current: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
});
