import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import FloatingPill from './FloatingPill';

import { colors, layout, lineHeights, scale, sizes, typography } from '@/styles/designTokens';

export type ToolbarTitleProps = { title?: string; subtitle?: string; isPlain?: boolean; style?: StyleProp<ViewStyle> };

// Text in a toolbar: a FloatingPill one button tall with a one-line `title` and an optional smaller
// `subtitle` under it (a photo's date and place). `isPlain` drops the pill for a bolder title on its
// own, as a sheet's header has it (ModalHeader). It takes no touches. style is for layout only (a max width).
export default function ToolbarTitle({ title, subtitle, isPlain = false, style }: ToolbarTitleProps) {
  const content = (
    <View style={[styles.content, !!subtitle && styles.twoLines]} pointerEvents="none">
      {!!title && (
        <Text style={[styles.title, isPlain && styles.plainTitle]} numberOfLines={1}>
          {title}
        </Text>
      )}
      {!!subtitle && (
        <Text style={[styles.subtitle, isPlain && styles.plainSubtitle]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  if (isPlain) return <View style={[styles.pill, style]}>{content}</View>;
  return <FloatingPill style={[styles.pill, style]}>{content}</FloatingPill>;
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
  plainTitle: {
    fontSize: typography.body,
    lineHeight: scale(22),
    fontWeight: '700',
  },
  plainSubtitle: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
  },
  subtitle: {
    fontSize: typography.caption2,
    lineHeight: lineHeights.caption2,
    color: colors.text.secondary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
