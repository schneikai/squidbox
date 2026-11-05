import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import FloatingPill from './FloatingPill';

import { colors, layout, lineHeights, scale, sizes, typography } from '@/styles/designTokens';

export type ToolbarTitleProps = { title?: string; subtitle?: string; style?: StyleProp<ViewStyle> };

// Text in a toolbar: a FloatingPill one button tall with a one-line `title` and an optional smaller
// `subtitle` under it (a photo's date and place). It takes no touches. style is for layout only (a max width).
export default function ToolbarTitle({ title, subtitle, style }: ToolbarTitleProps) {
  return (
    <FloatingPill style={[styles.pill, style]}>
      <View style={[styles.content, !!subtitle && styles.twoLines]} pointerEvents="none">
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </FloatingPill>
  );
}

const styles = StyleSheet.create({
  pill: {
    maxWidth: '100%',
    minWidth: 80,
    alignSelf: 'center',
  },
  content: {
    minHeight: sizes.iconButton,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1, // fills a pill held at its minWidth, so a short title stays centred in it
    flexShrink: 1,
    paddingHorizontal: layout.barPaddingX * 1.25,
  },
  twoLines: {
    paddingHorizontal: layout.barPaddingX * 2,
  },
  title: {
    fontSize: typography.subheadline,
    lineHeight: scale(17),
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: typography.caption2,
    lineHeight: lineHeights.caption2,
    color: colors.text.secondary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
