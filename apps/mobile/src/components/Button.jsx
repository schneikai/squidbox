import { useContext } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import IconSlotContext from '@/components/IconSlotContext';
import { colors, disabledOpacity, layout, press, radii, scale, sizes, space, textStyles } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const PALETTE = {
  neutral: colors.text.primary,
  muted: colors.text.secondary,
  accent: colors.accent.base,
  danger: colors.status.danger,
  // A favorite's heart: like `muted` until it's selected, then red.
  favorite: colors.text.secondary,
};
const INVERSE_PALETTE = {
  neutral: colors.text.inverse,
  accent: colors.accent.onDark,
};
// Every size has one height, for its discs and pills alike, so they line up side by side.
const HEIGHTS = { regular: sizes.iconButton, small: sizes.smallButton };
// Each shape's icon, by size. A small disc's or pill's is small enough to sit in 28 pt; a link's sits
// beside its label; a bare (tertiary) icon is as wide as itself.
const FILLED_ICON_SIZES = { regular: sizes.icon, small: scale(14) };
const ICON_SIZES = {
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
const VARIANTS = ['primary', 'secondary', 'tertiary'];
// A link's touch reaches a little past its text: a small one's further, to make up its 44 pt, and a
// caption one's (no padding around a line of about 16 pt) furthest.
const LINK_HIT_SLOP = { regular: 8, small: 12, caption: 16 };

/**
 * Every button in the app: a `variant`, an `icon` or a `label`, in one of two sizes.
 *   primary   — the violet gradient: a disc with an `icon` (at most one per toolbar), or a pill
 *               with a `label` (an icon may lead it): Add and Save in a header, a screen's main
 *               action (its parent stretches it across), Repost in a card.
 *   secondary — a grey fill: a disc with an `icon` or a `label` of up to 3 characters (18+), or a
 *               pill with a longer `label`, in dark text (Later beside Repost).
 *               `colorPalette="danger"` makes the disc red; `isInverse` makes it dark and
 *               translucent with a white icon, over a picture (× on a photo tile).
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
 * `loading` shows a spinner and blocks presses. style is for layout only.
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
}) {
  const hasIconSlot = useContext(IconSlotContext);
  const shape = shapeFor(variant, label);
  const palette = colorPalette ?? defaultPalette(shape, variant);
  const isInactive = disabled || loading;
  if (__DEV__) warnOnce(combinationProblem({ variant, icon, label, size, iconCount, isInverse, palette }));

  const color = contentColor({ variant, palette, isSelected, isInverse });
  const iconSize = ICON_SIZES[shape][size];
  const box = boxFor(shape, size, iconSize, hasIconSlot);
  const fill = fillFor({ shape, variant, palette, isSelected, isInverse });
  const pillFill = shape === 'pill' && [styles.pillFill, styles[`pillFill_${size}`]];
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
        shape === 'link' && styles[`link_${size}`],
        box,
        fill,
        pressed && !isInactive && pressedStyle(shape),
        isInactive && styles.disabled,
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
function shapeFor(variant, label) {
  if (variant === 'tertiary') return label ? 'link' : 'bare';
  if (label && (variant === 'primary' || label.length > MAX_DISC_LABEL)) return 'pill';
  return 'disc';
}

function defaultPalette(shape, variant) {
  if (shape === 'link') return 'accent';
  if (shape === 'pill' && variant === 'secondary') return 'neutral';
  return 'muted';
}

// The button's own box: a disc is its size's height square, a pill that tall, a bare icon that tall
// and as wide as its icon (a full slot in a toolbar or a picker, IconSlotContext). A link sizes itself.
function boxFor(shape, size, iconSize, hasIconSlot) {
  const height = HEIGHTS[size];
  if (shape === 'disc') return { width: height, height };
  if (shape === 'pill') return { height };
  if (shape === 'bare') return { width: hasIconSlot ? sizes.iconButton : iconSize, height };
  return null;
}

// What a touch reaches past the box, so the target is at least 44 pt each way.
function targetSlop(shape, size, box) {
  if (shape === 'link') return LINK_HIT_SLOP[size];
  const vertical = Math.max(0, (sizes.iconButton - box.height) / 2);
  const horizontal = box.width === undefined ? 0 : Math.max(0, (sizes.iconButton - box.width) / 2);
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

function Content({ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }) {
  // A link keeps its label and swaps its icon for the spinner; every other button shows only the spinner.
  const spinner = <ActivityIndicator size="small" color={color} />;
  if (loading && shape !== 'link') return spinner;
  if (shape === 'disc' && label) return <Text style={[styles.discLabel, { color }]}>{label}</Text>;
  if (iconCount === 2) {
    return (
      <View style={styles.pair}>
        <Icon name={icon} size={PAIR_ICON_SIZE} color={color} filled={filled} />
        <Icon name={icon} size={PAIR_ICON_SIZE} color={color} filled={filled} />
      </View>
    );
  }
  if (shape === 'disc' || shape === 'bare') return <Icon name={icon} size={iconSize} color={color} filled={filled} />;

  return (
    <>
      {loading ? spinner : icon && <Icon name={icon} size={iconSize} color={color} />}
      <Text style={[styles[`${shape}Label_${size}`], size === 'caption' && listTextStyles.caption, { color }]}>
        {label}
      </Text>
    </>
  );
}

function contentColor({ variant, palette, isSelected, isInverse }) {
  if (variant === 'primary') return colors.text.inverse;
  if (variant === 'secondary' && (palette === 'danger' || isInverse)) return colors.text.inverse;
  if (isSelected) return palette === 'favorite' ? colors.status.danger : colors.accent.base;
  if (isInverse) return INVERSE_PALETTE[palette];
  return PALETTE[palette];
}

// A secondary's fill (a primary's is its gradient; a tertiary has none).
function fillFor({ shape, variant, palette, isSelected, isInverse }) {
  if (variant !== 'secondary') return null;
  if (shape === 'pill') return styles.mutedFill;
  if (isInverse) return styles.inverseFill;
  if (palette === 'danger') return styles.dangerFill;
  if (isSelected) return styles.selectedFill;
  return styles.mutedFill;
}

// Everything filled dims and shrinks; a link or a bare icon fades.
function pressedStyle(shape) {
  return shape === 'link' || shape === 'bare' ? press.flat : press.filled;
}

// Why these props make no button the app has, or null.
function combinationProblem({ variant, icon, label, size, iconCount, isInverse, palette }) {
  if (!icon && !label) return 'Button: needs an icon or a label';
  if (!VARIANTS.includes(variant)) return `Button: no variant "${variant}"`;
  if (iconCount === 2 && label) return 'Button: a doubled icon has no label';
  if (size === 'caption' && !(variant === 'tertiary' && label)) return 'Button: only a link comes in caption size';
  if (variant === 'secondary' && icon && label) return 'Button: a secondary shows an icon or a label, not both';
  if (variant === 'secondary' && (palette === 'danger' || isInverse) && label?.length > MAX_DISC_LABEL) {
    return 'Button: a red or inverse secondary is a disc; its label must fit in it';
  }
  if (isInverse && variant === 'tertiary' && !INVERSE_PALETTE[palette]) {
    return `Button: no "${palette}" on a dark surface`;
  }
  if (!PALETTE[palette]) return `Button: no colorPalette "${palette}"`;
  return null;
}

const warned = new Set();
function warnOnce(problem) {
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
  selectedFill: {
    backgroundColor: colors.accent.light,
  },
  dangerFill: {
    backgroundColor: colors.status.danger,
  },
  discLabel: textStyles.footnoteBold,
  pair: {
    flexDirection: 'row',
    gap: space.hair,
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
    gap: layout.iconGap,
    paddingHorizontal: space.lg,
  },
  pillFill_small: {
    gap: layout.iconGapSmall,
    paddingHorizontal: space.md,
  },
  pillLabel_regular: textStyles.subheadlineBold,
  pillLabel_small: textStyles.footnoteBold,
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.iconGapSmall,
  },
  // AddRow and PostedAtPicker undo this horizontal padding to line a link up with the text beside it.
  link_regular: {
    paddingVertical: space.md,
    paddingHorizontal: space.xxl,
  },
  link_small: {
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
  },
  linkLabel_regular: textStyles.subheadline,
  linkLabel_small: textStyles.footnote,
  disabled: {
    opacity: disabledOpacity,
  },
});
