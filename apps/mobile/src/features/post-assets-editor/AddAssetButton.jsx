import { StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

export default function AddAssetButton({ onPress, itemDimension }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.rowItem, itemDimension]} accessibilityLabel="Add photos">
      <View style={styles.addItem}>
        <Icon name="add" size={sizes.iconLarge} color={colors.text.secondary} />
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
    backgroundColor: colors.background.muted,
  },
});
