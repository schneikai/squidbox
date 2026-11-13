import { StyleSheet, Text, View } from 'react-native';

import { colors, layout, space, textStyles } from '@/styles/designTokens';

type MenuTitleProps = { label: string };

// A popup menu's title above its rows, small and grey (Channel of this post): read as a heading, never
// pressed. MenuButton draws it from its `title`.
export default function MenuTitle({ label }: MenuTitleProps) {
  return (
    <View style={styles.row}>
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: layout.menuRowPaddingX,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  label: {
    ...textStyles.footnoteBold,
    color: colors.text.secondary,
  },
});
