import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import UncensoredBadge from './UncensoredBadge';
import formatCost from './formatCost';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes, typography } from '@/styles/designTokens';

// A Venice model on the Add screen: name, Uncensored badge, cost line, and a check once it's in
// your list.
export default function AddModelRow({ model, kind, isAdded, onAdd }) {
  const cost = formatCost(kind === 'vision' ? model.costPer100PhotosUsd : model.costPerReplyUsd, kind);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onAdd}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityState={{ selected: isAdded }}
    >
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={styles.name} numberOfLines={1}>
            {model.name}
          </Text>
          {model.isUncensored && <UncensoredBadge />}
        </View>
        <Text style={styles.detail} numberOfLines={1}>
          {cost}
        </Text>
      </View>
      {isAdded && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  detail: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
});
