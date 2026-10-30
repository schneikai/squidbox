import { Pressable, StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, press, sizes } from '@/styles/designTokens';

export default function AddAssetButton({ onPress, itemDimension }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowItem, itemDimension, pressed && press.flat]}
      accessibilityLabel="Add photos"
    >
      <View style={styles.addItem}>
        <Icon name="add" size={sizes.iconLarge} color={colors.text.secondary} />
      </View>
    </Pressable>
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
