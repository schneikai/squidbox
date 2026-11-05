import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import { colors, radii, scale, shadows, sizes } from '@/styles/designTokens';

// The inset the row's chips keep from the tray's edges.
const TRAY_INSET = scale(12);

const FADE = [colors.background.assistantClear, colors.background.assistant];
const FADE_START = { x: 0, y: 0 };
const FADE_END = { x: 1, y: 0 };

/**
 * The assistant's look for a group of its actions: a lavender tray, lit along its edge, under a
 * violet sparkle and `title` (Write with AI), with `trailing` at the end of the title's line (a small
 * button, EditPromptButtonsButton). `children` is one row that scrolls sideways across the tray's
 * full width (PromptButtonRow), fading out at its right edge; the tray gives the row its inset and
 * the pen its accent (AssistantTrayContext). The fade is static and only as wide as the inset, so it
 * veils a chip passing under the edge but never one at rest or at the row's end. style is for layout
 * only.
 */
export default function AssistantTray({ title, trailing, children, style }) {
  return (
    <AssistantTrayContext.Provider value={TRAY_INSET}>
      <View style={[styles.tray, style]}>
        <View style={styles.header}>
          <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} />
          <Text variant="assistant" style={styles.title}>
            {title}
          </Text>
          {trailing}
        </View>
        <View>
          {children}
          <LinearGradient colors={FADE} start={FADE_START} end={FADE_END} style={styles.fade} pointerEvents="none" />
        </View>
      </View>
    </AssistantTrayContext.Provider>
  );
}

const styles = StyleSheet.create({
  tray: {
    paddingVertical: TRAY_INSET,
    gap: scale(8),
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.background.assistant,
    ...shadows.litEdge,
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
  },
  fade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: TRAY_INSET,
  },
});
