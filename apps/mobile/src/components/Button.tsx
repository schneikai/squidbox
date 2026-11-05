import { useContext } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import FadedGroupContext from '@/components/FadedGroupContext';
import GradientFill from '@/components/GradientFill';
import Icon, { type IconName } from '@/components/Icon';
import IconSlotContext from '@/components/IconSlotContext';
import { colors, disabledOpacity, press, radii, scale, sizes, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const PALETTE = {
  neutral: colors.text.primary,
  muted: colors.text.secondary,
  accent: colors.accent.base,
  danger: colors.status.danger,
  // A favorite's heart: like `muted` until it's selected, then red.
  favorite: colors.text.secondary,
};
type Palette = keyof typeof PALETTE;
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'regular' | 'small' | 'caption';
type Shape = 'disc' | 'pill' | 'link' | 'bare';

// Only these palettes have a color on a dark surface (combinationProblem warns about the others).
const INVERSE_PALETTE: Partial<Record<Palette, string>> = {
  neutral: colors.text.inverse,
  accent: colors.accent.onDark,
};
// Every size has one height, for its discs and pills alike, so they line up side by side.
// A caption link has none (a link sizes itself).
const HEIGHTS: Partial<Record<ButtonSize, number>> = { regular: sizes.iconButton, small: sizes.smallButton };
// Each shape's icon, by size. A small disc's or pill's is small enough to sit in 28 pt; a link's sits
// beside its label; a bare (tertiary) icon is as wide as itself.
const FILLED_ICON_SIZES = { regular: sizes.icon, small: scale(14) };
const ICON_SIZES: Record<Shape, Partial<Record<ButtonSize, number>>> = {
  disc: FILLED_ICON_SIZES,
  pill: FILLED_ICON_SIZES,
  link: { regular: scale(16), small: scale(14) },
  bare: { regular: sizes.icon, small: sizes.iconSmall },
};
// Two icons side by side, small enough to fit the disc apart.
const PAIR_ICON_SIZE = scale(15);
// A secondary's label this short stands in for an icon in the disc (18+); a longer one makes it a
// grey pill.
const MAX_DISC_LABEL = 3;
const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'tertiary'];
// A link's touch reaches a little past its text: a small one's further, to make up its 44 pt, and a
// caption one's (no padding around a line of about 16 pt) furthest.
const LINK_HIT_SLOP: Record<ButtonSize, number> = { regular: 8, small: 12, caption: 16 };

export type ButtonProps = {
  icon?: IconName;
  label?: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  colorPalette?: Palette;
  size?: ButtonSize;
  isSelected?: boolean;
  isInverse?: boolean;
  isSwitch?: boolean;
  filled?: boolean;
  iconCount?: 1 | 2;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Every button in the app: a `variant`, an `icon` or a `label`, in one of two sizes.
 *   primary   — the violet gradient: a disc with an `icon` (at most one per toolbar), or a pill
 *               with a `label` (an icon may lead it): Add and Save in a header, a screen's main
 *               action (its parent stretches it across), Repost in a card.
 *   secondary — a grey fill: a disc with an `icon` or a `label` of up to 3 characters (18+), or a
 *               pill with a longer `label`, in dark text (Later beside Repost).
 *               `colorPalette="danger"` makes the disc red, `accent` light violet with a violet
 *               icon (the pen on the assistant's tray; a pill stays grey); `isInverse` makes it
 *               dark and translucent with a white icon, over a picture (× on a photo tile).
 *   tertiary  — no fill (the default): a bare `icon` (a toolbar's, a row's), or with a `label` a
 *               text link (an icon may lead it).
 * `size` is `regular` (44 pt tall, discs and pills alike) or `small` (28 pt), so a pill and a disc
 * of one size line up; a bare icon is as tall as its size and only as wide as the icon. Whatever
 * its size, every button takes a 44 pt tap target (hitSlop), and in a toolbar (FloatingPill) or a picker
 * (IconSlotContext) a bare icon takes a 44 pt slot. A link has its own height, regular or small; a
 * link can also be `caption`: no padding, as small and bold as the caption beside it
 * (`listTextStyles.caption`), a tap in a row of captions (a thread's "Thread · 3").
 * `colorPalette` is what its color means: `neutral`, `muted`, `accent`, `danger` or `favorite`
 * (a heart); a link is `accent`, a secondary pill `neutral` and an icon `muted` unless told,
 * wherever it sits. `isInverse` puts a link on a dark surface (the Undo bar). `isSelected` marks a
 * toggle that is on: a secondary tints its disc, a bare icon takes the accent (a heart turns red);
 * on a primary, the current tab, it only tells VoiceOver. `isSwitch` has VoiceOver read it as a
 * switch, for a setting it turns on and off (18+).
 * `filled` fills the icon; `iconCount={2}` doubles it, smaller, for a second step of the same mark.
 * `loading` shows a spinner and blocks presses. Off (`disabled` or `loading`) it fades, unless the
 * surface around it fades with it (FadedGroupContext). style is for layout only.
 */
export default function Button({
  icon,
  label,
  onPress,
  variant = 'tertiary',
  colorPalette,
  size = 'regular',
  isSelected = false,
  isInverse = false,
  isSwitch = false,
  filled,
  iconCount = 1,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const hasIconSlot = useContext(IconSlotContext);
  const isFadedByGroup = useContext(FadedGroupContext);
  const shape = shapeFor(variant, label);
  const palette = colorPalette ?? defaultPalette(shape, variant);
  const isInactive = disabled || loading;
  if (__DEV__) warnOnce(combinationProblem({ variant, icon, label, size, iconCount, isInverse, palette }));

  const color = contentColor({ variant, palette, isSelected, isInverse });
  const iconSize = ICON_SIZES[shape][size];
  const box = boxFor(shape, size, iconSize, hasIconSlot);
  const fill = fillFor({ shape, variant, palette, isSelected, isInverse });
  const pillFill = shape === 'pill' && [styles.pillFill, PILL_FILL_SIZE_STYLES[size]];
  const content = <Content {...{ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }} />;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      hitSlop={targetSlop(shape, size, box)}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading, [isSwitch ? 'checked' : 'selected']: isSelected }}
      style={({ pressed }) => [
        styles[shape],
        shape === 'link' && LINK_SIZE_STYLES[size],
        box,
        fill,
        pressed && !isInactive && pressedStyle(shape),
        isInactive && !isFadedByGroup && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <GradientFill style={pillFill || styles.discFill}>{content}</GradientFill>
      ) : shape === 'pill' ? (
        <View style={pillFill}>{content}</View>
      ) : (
        content
      )}
    </Pressable>
  );
}

// A tertiary is a link with a label and a bare icon without; a primary or secondary is a pill with a
// label (a secondary's short one stays in its disc) and a disc without.
function shapeFor(variant: ButtonVariant, label: string | undefined): Shape {
  if (variant === 'tertiary') return label ? 'link' : 'bare';
  if (label && (variant === 'primary' || label.length > MAX_DISC_LABEL)) return 'pill';
  return 'disc';
}

function defaultPalette(shape: Shape, variant: ButtonVariant): Palette {
  if (shape === 'link') return 'accent';
  if (shape === 'pill' && variant === 'secondary') return 'neutral';
  return 'muted';
}

// The button's own box: a disc is its size's height square, a pill that tall, a bare icon that tall
// and as wide as its icon (a full slot in a toolbar or a picker, IconSlotContext). A link sizes itself.
function boxFor(
  shape: Shape,
  size: ButtonSize,
  iconSize: number | undefined,
  hasIconSlot: boolean,
): { width?: number; height?: number } | null {
  const height = HEIGHTS[size];
  if (shape === 'disc') return { width: height, height };
  if (shape === 'pill') return { height };
  if (shape === 'bare') return { width: hasIconSlot ? sizes.iconButton : iconSize, height };
  return null;
}

// What a touch reaches past the box, so the target is at least 44 pt each way.
function targetSlop(shape: Shape, size: ButtonSize, box: { width?: number; height?: number } | null) {
  // Only a link has no box.
  if (shape === 'link' || !box) return LINK_HIT_SLOP[size];
  const vertical = box.height === undefined ? 0 : Math.max(0, (sizes.iconButton - box.height) / 2);
  const horizontal = box.width === undefined ? 0 : Math.max(0, (sizes.iconButton - box.width) / 2);
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

type ContentProps = Pick<ButtonProps, 'icon' | 'label' | 'filled'> & {
  loading: boolean;
  color: string | undefined;
  iconSize: number | undefined;
  iconCount: 1 | 2;
  shape: Shape;
  size: ButtonSize;
  palette: Palette;
};
function Content({ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }: ContentProps) {
  // A link keeps its label and swaps its icon for the spinner; every other button shows only the spinner.
  const spinner = <ActivityIndicator size="small" color={color} />;
  if (loading && shape !== 'link') return spinner;
  if (shape === 'disc' && label) return <Text style={[styles.discLabel, { color }]}>{label}</Text>;
  if (iconCount === 2 || shape === 'disc' || shape === 'bare') {
    // Without an icon there is nothing to show (combinationProblem warns).
    if (!icon) return null;
    if (iconCount === 2) {
      return (
        <View style={styles.pair}>
          <Icon name={icon} size={PAIR_ICON_SIZE} color={color} filled={filled} />
          <Icon name={icon} size={PAIR_ICON_SIZE} color={color} filled={filled} />
        </View>
      );
    }
    return <Icon name={icon} size={iconSize} color={color} filled={filled} />;
  }

  return (
    <>
      {loading ? spinner : icon && <Icon name={icon} size={iconSize} color={color} />}
      <Text
        style={[
          LABEL_STYLES[shape],
          LABEL_SIZE_STYLES[shape]?.[size],
          size === 'caption' && listTextStyles.caption,
          shape === 'link' && palette === 'muted' && size !== 'caption' && styles.linkLabelMuted,
          { color },
        ]}
      >
        {label}
      </Text>
    </>
  );
}

type Look = { variant: ButtonVariant; palette: Palette; isSelected: boolean; isInverse: boolean };

function contentColor({ variant, palette, isSelected, isInverse }: Look) {
  if (variant === 'primary') return colors.text.inverse;
  if (variant === 'secondary' && (palette === 'danger' || isInverse)) return colors.text.inverse;
  if (isSelected) return palette === 'favorite' ? colors.status.danger : colors.accent.base;
  if (isInverse) return INVERSE_PALETTE[palette];
  return PALETTE[palette];
}

// A secondary's fill (a primary's is its gradient; a tertiary has none).
function fillFor({ shape, variant, palette, isSelected, isInverse }: Look & { shape: Shape }) {
  if (variant !== 'secondary') return null;
  if (shape === 'pill') return styles.mutedFill;
  if (isInverse) return styles.inverseFill;
  if (palette === 'danger') return styles.dangerFill;
  if (isSelected || palette === 'accent') return styles.accentFill;
  return styles.mutedFill;
}

// Everything filled dims and shrinks; a link or a bare icon fades.
function pressedStyle(shape: Shape) {
  return shape === 'link' || shape === 'bare' ? press.flat : press.filled;
}

// Why these props make no button the app has, or null.
function combinationProblem({
  variant,
  icon,
  label,
  size,
  iconCount,
  isInverse,
  palette,
}: Pick<ButtonProps, 'icon' | 'label'> & {
  variant: ButtonVariant;
  size: ButtonSize;
  iconCount: 1 | 2;
  isInverse: boolean;
  palette: Palette;
}) {
  if (!icon && !label) return 'Button: needs an icon or a label';
  if (!VARIANTS.includes(variant)) return `Button: no variant "${variant}"`;
  if (iconCount === 2 && label) return 'Button: a doubled icon has no label';
  if (size === 'caption' && !(variant === 'tertiary' && label)) return 'Button: only a link comes in caption size';
  if (variant === 'secondary' && icon && label) return 'Button: a secondary shows an icon or a label, not both';
  if (variant === 'secondary' && (palette === 'danger' || isInverse) && (label?.length ?? 0) > MAX_DISC_LABEL) {
    return 'Button: a red or inverse secondary is a disc; its label must fit in it';
  }
  if (isInverse && variant === 'tertiary' && !INVERSE_PALETTE[palette]) {
    return `Button: no "${palette}" on a dark surface`;
  }
  if (!PALETTE[palette]) return `Button: no colorPalette "${palette}"`;
  return null;
}

const warned = new Set<string>();
function warnOnce(problem: string | null) {
  if (!problem || warned.has(problem)) return;
  warned.add(problem);
  console.warn(problem);
}

const styles = StyleSheet.create({
  disc: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bare: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  discFill: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedFill: {
    backgroundColor: colors.overlay.pressed,
  },
  inverseFill: {
    backgroundColor: colors.overlay.dim,
  },
  accentFill: {
    backgroundColor: colors.accent.light,
  },
  dangerFill: {
    backgroundColor: colors.status.danger,
  },
  discLabel: {
    fontSize: typography.footnote,
    fontWeight: '700',
  },
  pair: {
    flexDirection: 'row',
    gap: 2,
  },
  pill: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  pillFill: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFill_regular: {
    gap: scale(6),
    paddingHorizontal: scale(16),
  },
  pillFill_small: {
    gap: scale(4),
    paddingHorizontal: scale(10),
  },
  pillLabel: {
    fontWeight: '600',
  },
  pillLabel_regular: {
    fontSize: typography.subheadline,
  },
  pillLabel_small: {
    fontSize: typography.footnote,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  link_regular: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  link_small: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  linkLabel: {
    fontWeight: '500',
  },
  linkLabel_regular: {
    fontSize: typography.subheadline,
  },
  linkLabel_small: {
    fontSize: typography.footnote,
  },
  linkLabelMuted: {
    fontWeight: '400',
  },
  disabled: {
    opacity: disabledOpacity,
  },
});

// The styles by shape and size, where a combination has one (the others stay undefined in the style
// array).
const PILL_FILL_SIZE_STYLES: Partial<Record<ButtonSize, ViewStyle>> = {
  regular: styles.pillFill_regular,
  small: styles.pillFill_small,
};
const LINK_SIZE_STYLES: Partial<Record<ButtonSize, ViewStyle>> = {
  regular: styles.link_regular,
  small: styles.link_small,
};
const LABEL_STYLES: Partial<Record<Shape, TextStyle>> = { pill: styles.pillLabel, link: styles.linkLabel };
const LABEL_SIZE_STYLES: Partial<Record<Shape, Partial<Record<ButtonSize, TextStyle>>>> = {
  pill: { regular: styles.pillLabel_regular, small: styles.pillLabel_small },
  link: { regular: styles.linkLabel_regular, small: styles.linkLabel_small },
};
