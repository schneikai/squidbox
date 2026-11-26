import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, layout, sizes, textStyles } from '@/styles/designTokens';

export type ToolbarTitleProps = { title?: string; subtitle?: string; style?: StyleProp<ViewStyle> };

// A header's title: a bold one-line `title` and an optional smaller grey `subtitle` under it (a photo's
// date and place), plain text over the scroll edge (ScrollEdgeFade), never in a pill, as iOS 26 has it. The
// one exception is the photo detail screen (FloatingDetailHeader's isTitleInPill).
// One button tall. It takes no touches. style is for layout only (a max width).
export default function ToolbarTitle({ title, subtitle, style }: ToolbarTitleProps) {
  return (
    <View style={[styles.frame, !!subtitle && styles.twoLines, style]} pointerEvents="none">
      {!!title && (
        <Text testID="toolbar-title" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}
      {!!subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    maxWidth: '100%',
    minWidth: 80,
    alignSelf: 'center',
    minHeight: sizes.iconButton,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 1,
    // eslint-disable-next-line no-restricted-syntax -- optical: a title's ends want more room than a button's
    paddingHorizontal: layout.barPaddingX * 1.25,
  },
  twoLines: {
    // eslint-disable-next-line no-restricted-syntax -- as above, more for two lines
    paddingHorizontal: layout.barPaddingX * 2,
  },
  title: {
    ...textStyles.subheadlineBold,
    color: colors.text.primary,
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    ...textStyles.caption1,
    color: colors.text.secondary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
