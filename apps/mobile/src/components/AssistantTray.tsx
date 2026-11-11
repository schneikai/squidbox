import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import Shine from '@/components/Shine';
import Text from '@/components/Text';
import WorkingSparkle from '@/components/WorkingSparkle';
import { colors, layout, radii, raisedShadowRoom, shadows, sizes, space } from '@/styles/designTokens';

// The inset the row's chips keep from the tray's edges.
const TRAY_INSET = layout.objectInset;

// What the tray gives what it holds (AssistantTrayContext).
const TRAY = { inset: TRAY_INSET };

const FADE = [colors.background.assistantClear, colors.background.assistant] as const;
const FADE_START = { x: 0, y: 0 };
const FADE_END = { x: 1, y: 0 };

export type AssistantTrayProps = {
  title: string;
  isWorking?: boolean;
  onBack?: (() => void) | null;
  backLabel?: string;
  trailing?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The assistant's look for a group of its actions: a lavender tray, lit along its edge, under a
 * violet sparkle and `title` (Write with AI, Ideas), with `trailing` at the end of the title's line
 * (a small button: Chat). While `isWorking` the sparkle is at work (WorkingSparkle) and a light band
 * sweeps across the title in step (Writing ideas…). With `onBack` the title is a back button instead
 * (‹ and `title`, read as `backLabel`), returning to what the tray showed before. `children` is one
 * row that scrolls sideways across the tray's full width (PromptButtonRow, the ideas' carousel),
 * fading out at its right edge; the tray gives the row its inset and the pen its light violet disc
 * (AssistantTrayContext), and draws its lit rim over the row. `footer` follows the row, at the
 * tray's inset (a grey line). The fade is static and only as wide as the inset, so it veils a chip
 * passing under the edge but never one at rest or at the row's end. style is for layout only.
 */
export default function AssistantTray({
  title,
  isWorking = false,
  onBack,
  backLabel,
  trailing,
  children,
  footer,
  style,
}: AssistantTrayProps) {
  const titleText = (tone?: 'shine') => (
    <Text variant="assistant" tone={tone} numberOfLines={1}>
      {title}
    </Text>
  );

  return (
    <AssistantTrayContext.Provider value={TRAY}>
      <View style={[styles.tray, style]}>
        <View style={styles.content}>
          <View style={styles.header}>
            {onBack ? (
              <View style={styles.lead}>
                <Button
                  icon="chevron-left"
                  label={title}
                  variant="tertiary"
                  colorPalette="accent"
                  size="small"
                  accessibilityLabel={backLabel}
                  onPress={onBack}
                />
              </View>
            ) : (
              <View style={[styles.lead, styles.titleRow]}>
                {isWorking ? (
                  <WorkingSparkle size={sizes.menuIcon} />
                ) : (
                  <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} />
                )}
                <Shine isOn={isWorking} highlight={titleText('shine')}>
                  {titleText()}
                </Shine>
              </View>
            )}
            {trailing}
          </View>
          {children !== undefined && (
            <View>
              {children}
              <LinearGradient
                colors={FADE}
                start={FADE_START}
                end={FADE_END}
                style={styles.fade}
                pointerEvents="none"
              />
            </View>
          )}
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
        <View style={styles.rim} pointerEvents="none" />
      </View>
    </AssistantTrayContext.Provider>
  );
}

const styles = StyleSheet.create({
  tray: {
    paddingVertical: TRAY_INSET,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.background.assistant,
  },
  // The lit edge, drawn over the row so the chips scrolling under the tray's edges and the fade
  // don't cover it.
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.card,
    ...shadows.litEdgeTint,
  },
  // The gap is here, not on the tray, as iOS counts the absolute rim in a gap too.
  content: {
    gap: space.sm,
  },
  // The title sits a hair further in than the chips, as the sparkle's glyph is narrower than its box.
  // Over the row, so the room it leaves for its chips' shadow doesn't take the trailing button's taps.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
    minHeight: sizes.smallButton,
    paddingHorizontal: TRAY_INSET + space.hair,
    zIndex: 1,
  },
  lead: {
    flex: 1,
    flexDirection: 'row',
  },
  titleRow: {
    alignItems: 'center',
    gap: layout.iconGap,
  },
  // Over the chips' shadow room too, so a shadow passing under the edge fades with its chip.
  fade: {
    position: 'absolute',
    top: -raisedShadowRoom.top,
    right: 0,
    bottom: -raisedShadowRoom.bottom,
    width: TRAY_INSET,
  },
  footer: {
    paddingHorizontal: TRAY_INSET + space.hair,
  },
});
