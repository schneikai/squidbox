import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import Icon from '@/components/Icon';
import Shine from '@/components/Shine';
import Text from '@/components/Text';
import useShineProgress from '@/hooks/useShineProgress';
import { colors, layout, motion, press, radii, raisedShadowRoom, shadows, sizes, space } from '@/styles/designTokens';

// The inset the row's chips keep from the tray's edges.
const TRAY_INSET = layout.objectInset;

// What the tray gives what it holds (AssistantTrayContext).
const TRAY = { inset: TRAY_INSET };

const FADE = [colors.background.assistantClear, colors.background.assistant] as const;
const FADE_START = { x: 0, y: 0 };
const FADE_END = { x: 1, y: 0 };

// The header is a chip's height: its buttons (the back title, the fold) reach a 44 pt target.
const HEADER_HEIGHT = sizes.smallButton + space.sm;
// The caret, in the Chat chip's place, as easy to hit.
const CARET_HIT_SLOP = (sizes.iconButton - sizes.menuIcon) / 2;
const HEADER_HIT_SLOP = {
  top: (sizes.iconButton - HEADER_HEIGHT) / 2,
  bottom: (sizes.iconButton - HEADER_HEIGHT) / 2,
};

export type AssistantTrayProps = {
  title: string;
  isWorking?: boolean;
  back?: { label: string; onPress: () => void } | null;
  // `foldLabel` names the fold (Hide ideas), `unfoldHint` what a tap on the folded tray does.
  fold?: { isFolded: boolean; onToggle: () => void; foldLabel: string; unfoldHint: string } | null;
  trailing?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The assistant's look for a group of its actions: a lavender tray, lit along its edge, under a
 * violet sparkle and `title` (Write with AI, Ideas), with `trailing` at the end of the title's line
 * (a small button: Chat). While `isWorking` one light band
 * sweeps across the sparkle and the title together (Writing ideas…; none with Reduce Motion). With `back` the title is a back button instead
 * (‹ and `title`, read as `back.label`, `back.onPress`), returning to what the tray showed before. With `fold` the tray
 * folds to its header, with a caret down in `trailing`'s place; a tap on the title row (or, with
 * `back`, on the header's free space after it) folds it (`foldLabel`) and unfolds it (`onToggle`). `children` is one
 * row that scrolls sideways across the tray's full width (PromptButtonRow, the ideas' carousel),
 * fading out at its right edge; the tray gives the row its inset
 * (AssistantTrayContext), and draws its lit rim over the row. `footer` follows the row, at the
 * tray's inset (a grey line). The fade is static and only as wide as the inset, so it veils a chip
 * passing under the edge but never one at rest or at the row's end. style is for layout only.
 */
export default function AssistantTray({
  title,
  isWorking = false,
  back,
  fold,
  trailing,
  children,
  footer,
  style,
}: AssistantTrayProps) {
  const shine = useShineProgress(isWorking);
  const isFolded = fold?.isFolded ?? false;
  const { open, isNatural } = useFold(isFolded);
  // The back variant takes the sparkle's slot for its ‹, so the title stays put in every state.
  const isBack = Boolean(back) && !isFolded;
  // The mark and the title, in the accent or, for the band sweeping across both, in its light.
  const row = (tone?: 'shine') => (
    <View style={styles.titleRow}>
      <Icon
        name={isBack ? 'chevron-left' : 'sparkle'}
        size={sizes.menuIcon}
        color={tone ? colors.accent.shine : colors.accent.base}
      />
      <Text variant="assistant" tone={tone} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
  const lead = (
    <Shine progress={shine} highlight={row('shine')}>
      {row()}
    </Shine>
  );

  // The header is the same folded and open, but for the caret (down) in `trailing`'s place while
  // folded. The title row (or, beside a back button, the free space after it) folds and unfolds it.
  return (
    <AssistantTrayContext.Provider value={TRAY}>
      <View style={[styles.tray, style]}>
        <View style={styles.header}>
          {isBack && back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={back.label}
              onPress={back.onPress}
              hitSlop={HEADER_HIT_SLOP}
              style={({ pressed }) => [styles.titleRow, pressed && press.flat]}
            >
              {lead}
            </Pressable>
          )}
          <Pressable
            disabled={!fold}
            accessible={Boolean(fold)}
            accessibilityRole={fold ? 'button' : undefined}
            // The title is read as it shows (Writing ideas…), the fold as its hint; beside a back
            // button, this is only the fold.
            accessibilityLabel={fold ? (isBack ? fold.foldLabel : title) : undefined}
            accessibilityHint={fold && !isBack ? (isFolded ? fold.unfoldHint : fold.foldLabel) : undefined}
            accessibilityState={fold ? { expanded: !isFolded } : undefined}
            onPress={fold?.onToggle}
            hitSlop={HEADER_HIT_SLOP}
            style={({ pressed }) => [styles.lead, pressed && !isBack && press.flat]}
          >
            {!isBack && lead}
          </Pressable>
          {fold ? (
            <TrailingSwap isFolded={isFolded} open={open} onToggle={fold.onToggle}>
              {trailing}
            </TrailingSwap>
          ) : (
            trailing
          )}
        </View>
        <Body isFolded={isFolded} open={open} isNatural={isNatural}>
          <View>
            {children}
            <LinearGradient colors={FADE} start={FADE_START} end={FADE_END} style={styles.fade} pointerEvents="none" />
          </View>
          {footer && <View style={styles.footer}>{footer}</View>}
        </Body>
        <View style={styles.rim} pointerEvents="none" />
      </View>
    </AssistantTrayContext.Provider>
  );
}

// How open the tray is, 0 folded to 1 open, and whether it is at rest open (its body at its own
// height: always, except while it folds or unfolds and while folded). Only a fold or an unfold
// animates (motion.move), so what the body holds can change (skeletons to cards, a line appearing)
// without a glide or a clip.
function useFold(isFolded: boolean) {
  const open = useSharedValue(isFolded ? 0 : 1);
  const isNatural = useSharedValue(!isFolded);

  useEffect(() => {
    const target = isFolded ? 0 : 1;
    if (open.value === target) return;
    isNatural.value = false;
    open.value = withTiming(target, motion.move, (isFinished) => {
      if (isFinished && target === 1) isNatural.value = true;
    });
  }, [isFolded, open, isNatural]);

  return { open, isNatural };
}

type TrailingSwapProps = { isFolded: boolean; open: SharedValue<number>; onToggle: () => void; children: ReactNode };

// `trailing` (Chat) open, the caret folded, in the same place: as the tray folds, the chip slides
// out past the tray's edge (which clips it) and fades while the caret slides in from there, on the
// fold's own progress; the reverse as it unfolds. The header's layout never changes.
function TrailingSwap({ isFolded, open, onToggle, children }: TrailingSwapProps) {
  // How far the chip goes: its width and the header's inset, to past the tray's edge.
  const distance = useSharedValue(0);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ translateX: (1 - open.value) * distance.value }],
  }));
  const caretStyle = useAnimatedStyle(() => ({
    opacity: 1 - open.value,
    transform: [{ translateX: open.value * distance.value }],
  }));

  function handleLayout(event: LayoutChangeEvent) {
    distance.value = event.nativeEvent.layout.width + TRAY_INSET + space.hair;
  }

  return (
    <View onLayout={handleLayout}>
      <Animated.View
        style={chipStyle}
        pointerEvents={isFolded ? 'none' : 'box-none'}
        accessibilityElementsHidden={isFolded}
        importantForAccessibility={isFolded ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </Animated.View>
      <Animated.View style={[styles.caret, caretStyle]} pointerEvents={isFolded ? 'box-none' : 'none'}>
        <Pressable
          accessible={false}
          onPress={onToggle}
          hitSlop={CARET_HIT_SLOP}
          style={({ pressed }) => pressed && press.flat}
        >
          <Icon name="chevron-down" size={sizes.menuIcon} color={colors.accent.base} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

type BodyProps = { isFolded: boolean; open: SharedValue<number>; isNatural: SharedValue<boolean>; children: ReactNode };

// What the tray holds under its header, folding away as one motion (motion.move): its height goes
// from what it measures to 0, clipped, so nothing is added or removed from the layout at
// either end and the tray (with what follows it) glides; unfolding is the reverse. Open, it is at
// its own height, at once. It stays mounted while folded, hidden from touch and VoiceOver, and
// reaches the tray's bottom edge while open so its chips' shadows aren't cut.
function Body({ isFolded, open, isNatural, children }: BodyProps) {
  // What it measured last, the height a fold starts from.
  const height = useSharedValue(0);

  const foldStyle = useAnimatedStyle(() =>
    isNatural.value
      ? { height: 'auto' as const, marginBottom: -TRAY_INSET }
      : { height: height.value * open.value, marginBottom: -TRAY_INSET * open.value },
  );

  function handleLayout(event: LayoutChangeEvent) {
    height.value = event.nativeEvent.layout.height;
  }

  return (
    <Animated.View
      style={[styles.body, foldStyle]}
      pointerEvents={isFolded ? 'none' : 'auto'}
      accessibilityElementsHidden={isFolded}
      importantForAccessibility={isFolded ? 'no-hide-descendants' : 'auto'}
      aria-hidden={isFolded}
    >
      <View onLayout={handleLayout} style={styles.bodyContent}>
        {children}
      </View>
    </Animated.View>
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
  // At the slot's end, centred on the line.
  caret: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
  },
  body: {
    overflow: 'hidden',
  },
  // Its gaps are inside it, so they fold with it; down to the tray's bottom edge, for the shadows.
  bodyContent: {
    gap: space.sm,
    paddingTop: space.sm,
    paddingBottom: TRAY_INSET,
  },
  // The title sits a hair further in than the chips, as the sparkle's glyph is narrower than its box.
  // Over the row, so the room it leaves for its chips' shadow doesn't take the trailing button's taps.
  // Always a chip's height (chipFrame), with or without the trailing chip beside it, so the title doesn't
  // move as the tray folds and unfolds.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
    minHeight: HEADER_HEIGHT,
    paddingHorizontal: TRAY_INSET + space.hair,
    zIndex: 1,
  },
  // The title's slot, up to `trailing`; a button (Hide ideas) while the tray is open.
  lead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: layout.iconGap,
  },
  titleRow: {
    flexDirection: 'row',
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
  // A step further from the row than the header is, so the lines read as the tray's own, not a card's.
  footer: {
    paddingTop: space.xs,
    paddingHorizontal: TRAY_INSET + space.hair,
  },
});
