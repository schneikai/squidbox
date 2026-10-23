import { StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, spacing } from '@/styles/designTokens';

export default function AddAssetButton({ onAdd, itemDimension }) {
  return (
    <TouchableOpacity onPress={onAdd} style={[styles.rowItem, itemDimension]} accessibilityLabel="Add photos">
      <View style={styles.addItem}>
        <Icon name="add" size={spacing.iconSizeLarge} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowItem: {
    padding: 5,
  },
  addItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
  },
});
