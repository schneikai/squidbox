import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii, scale, shadows, sizes, typography } from '@/styles/designTokens';

// The inset the row's chips keep from the tray's edges (PromptButtonRow's `inset`).
export const TRAY_INSET = scale(12);

const FADE = [colors.background.assistantClear, colors.background.assistant];
const FADE_START = { x: 0, y: 0 };
const FADE_END = { x: 1, y: 0 };

/**
 * The assistant's look for a group of its actions: a lavender tray, lit along its edge, under a
 * violet sparkle and `title` (Write with AI), with `trailing` at the end of the title's line (a small
 * button). `children` is one row that scrolls sideways across the tray's full width, fading out at
 * its right edge; its chips keep `TRAY_INSET` from the tray's edges. The fade is static: it paints
 * even when the row fits. style is for layout only.
 */
export default function AssistantTray({ title, trailing, children, style }) {
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} />
        <Text style={styles.title}>{title}</Text>
        {trailing}
      </View>
      <View>
        {children}
        <LinearGradient colors={FADE} start={FADE_START} end={FADE_END} style={styles.fade} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    paddingVertical: TRAY_INSET,
    gap: scale(8),
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.background.assistant,
    boxShadow: shadows.litEdge.boxShadow,
  },
  // The title sits 2 pt further in than the chips, as the sparkle's glyph is narrower than its box.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    minHeight: sizes.smallButton,
    paddingHorizontal: TRAY_INSET + 2,
  },
  title: {
    flex: 1,
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.accent.base,
  },
  fade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: scale(32),
  },
});
