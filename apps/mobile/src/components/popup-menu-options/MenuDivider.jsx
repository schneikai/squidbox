import { StyleSheet, View } from 'react-native';

import { colors } from '@/styles/designTokens';

// Separates groups of menu rows, e.g. a destructive action from the rest.
export default function MenuDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.menuBorder,
    marginVertical: 4,
    marginHorizontal: 10,
  },
});
