import { useContext } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import ToolbarContext from '@/components/floating-bars/ToolbarContext';
import { colors, disabledOpacity, press, radii, scale, sizes, typography } from '@/styles/designTokens';

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
// A bare (tertiary) icon is as wide as itself.
const ICON_SIZES = { regular: sizes.icon, small: sizes.iconSmall };
// A small disc's icon, small enough to sit in its 28 pt disc.
const SMALL_DISC_ICON_SIZE = scale(14);
// Two icons side by side, small enough to fit the disc apart.
const PAIR_ICON_SIZE = scale(15);
// A pill's icon beside its label.
const PILL_ICON_SIZES = { regular: sizes.icon, small: scale(14) };
// A link's icon beside its label.
const LINK_ICON_SIZES = { regular: scale(16), small: scale(14) };
// A secondary's label this short stands in for an icon in the disc (18+); a longer one makes it a
// grey pill.
const MAX_DISC_LABEL = 3;

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
 * its size, every button takes a 44 pt tap target (hitSlop), and in a toolbar (FloatingPill) a bare
 * icon takes a 44 pt slot. A link has its own height, regular or small.
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
  hitSlop,
  accessibilityLabel,
  accessibilityHint,
  style,
}) {
  const isInToolbar = useContext(ToolbarContext);
  const shape = shapeFor(variant, label);
  const palette = colorPalette ?? defaultPalette(shape, variant);
  const isInactive = disabled || loading;
  if (__DEV__) warnOnce(combinationProblem({ variant, icon, label, isInverse, palette }));

  const color = contentColor({ variant, palette, isSelected, isInverse });
  const iconSize = iconSizeFor(shape, size);
  const box = boxFor(shape, size, iconSize, isInToolbar);
  const fill = fillFor({ shape, variant, palette, isSelected, isInverse });
  const content = <Content {...{ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }} />;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      hitSlop={hitSlop ?? targetSlop(shape, box)}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading, [isSwitch ? 'checked' : 'selected']: isSelected }}
      style={({ pressed }) => [
        styles[shape],
        shape === 'link' && size === 'small' && styles.linkSmall,
        box,
        fill,
        pressed && !isInactive && pressedStyle(shape),
        isInactive && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <GradientFill style={shape === 'pill' ? [styles.pillFill, styles[`pillFill_${size}`]] : styles.discFill}>
          {content}
        </GradientFill>
      ) : shape === 'pill' ? (
        <View style={[styles.pillFill, styles[`pillFill_${size}`]]}>{content}</View>
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

function iconSizeFor(shape, size) {
  if (shape === 'disc') return size === 'small' ? SMALL_DISC_ICON_SIZE : sizes.icon;
  if (shape === 'pill') return PILL_ICON_SIZES[size];
  if (shape === 'link') return LINK_ICON_SIZES[size];
  return ICON_SIZES[size];
}

// The button's own box: a disc is its size's height square, a pill that tall, a bare icon that tall
// and as wide as its icon (a full slot in a toolbar). A link sizes itself.
function boxFor(shape, size, iconSize, isInToolbar) {
  const height = HEIGHTS[size];
  if (shape === 'disc') return { width: height, height };
  if (shape === 'pill') return { height };
  if (shape === 'bare') return { width: isInToolbar ? sizes.iconButton : iconSize, height };
  return null;
}

// What a touch reaches past the box, so the target is at least 44 pt each way.
function targetSlop(shape, box) {
  if (shape === 'link') return LINK_HIT_SLOP;
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
      <Text
        style={[
          shape === 'link' ? styles.linkLabel : [styles.pillLabel, styles[`pillLabel_${size}`]],
          size === 'small' && shape === 'link' && styles.linkLabelSmall,
          shape === 'link' && palette === 'muted' && styles.linkLabelMuted,
          { color },
        ]}
      >
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
function combinationProblem({ variant, icon, label, isInverse, palette }) {
  if (!icon && !label) return 'Button: needs an icon or a label';
  if (!VARIANTS.includes(variant)) return `Button: no variant "${variant}"`;
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

const VARIANTS = ['primary', 'secondary', 'tertiary'];
// A link's touch reaches a little past its text.
const LINK_HIT_SLOP = 8;

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
  // Rounded itself: on iOS (SDK 58) the button's corners don't clip the gradient inside.
  discFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
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
    borderRadius: radii.pill,
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
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  linkSmall: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  linkLabel: {
    fontSize: typography.subheadline,
    fontWeight: '500',
  },
  linkLabelSmall: {
    fontSize: typography.footnote,
  },
  linkLabelMuted: {
    fontWeight: '400',
  },
  disabled: {
    opacity: disabledOpacity,
  },
});
