import { StyleSheet, View } from 'react-native';

import Text from '@/components/Text';
import { layout, space } from '@/styles/designTokens';

type MenuTitleProps = { label: string };

// A popup menu's title above its rows (Change X to, Add channel): read as a heading, never pressed.
// MenuButton draws it from its `title`.
export default function MenuTitle({ label }: MenuTitleProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="header">
      <Text variant="label">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: layout.menuRowPaddingX,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
});
