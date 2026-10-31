import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import { colors, disabledOpacity, press, radii, scale, sizes, typography } from '@/styles/designTokens';

const PALETTE = {
  neutral: colors.text.primary,
  muted: colors.text.secondary,
  accent: colors.accent.base,
  danger: colors.status.danger,
  // A favorite's heart: like `muted` until it's selected, then red, without the selected tint.
  favorite: colors.text.secondary,
};
const INVERSE_PALETTE = {
  neutral: colors.text.inverse,
  accent: colors.accent.onDark,
};
// Two icons side by side, small enough to fit the disc apart.
const PAIR_ICON_SIZE = scale(15);
// An overlay disc's icon, small enough to sit in its 28 pt disc.
const OVERLAY_ICON_SIZE = scale(14);
// What an overlay disc's touch reaches past its edge, so its target is still 44 pt.
const OVERLAY_HIT_SLOP = (sizes.iconButton - sizes.overlayButton) / 2;
// A secondary's label stands in for an icon in the disc (18+), so it must stay that short.
const MAX_DISC_LABEL = 3;

/**
 * Every button in the app. `variant` is how much it stands out:
 *   primary   — the violet gradient: a screen's main action with a `label` (50 pt tall at `size`
 *               regular, a 44 pt pill at small, as Save in a modal header), or an icon-only circle
 *               (at most one per toolbar).
 *   secondary — a grey disc over content: an `icon`, or a `label` of up to 3 characters (18+).
 *               `colorPalette="danger"` makes it a red disc.
 *   tertiary  — no fill (the default): an icon in a toolbar, or with a `label` a text link (an icon
 *               may lead it).
 *   overlay   — a small dark translucent disc with a white icon, over a picture (× on a photo
 *               tile): 28 pt, its touch target kept at 44 pt. `size="small"` draws a smaller icon in the same 44 pt target, or a
 *               tighter link for a header row.
 * `colorPalette` is what its color means: `neutral`, `muted`, `accent`, `danger` or `favorite`
 * (a heart); a text link is `accent` and an icon button `muted` unless told, wherever it sits. `isInverse` puts it on a
 * dark surface (the Undo bar). `isSelected` marks a toggle that is on (on a primary, the current tab, it only tells VoiceOver);
 * `isSwitch` has VoiceOver read it as a switch, for a setting it turns on and off (18+).
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
  const shape = shapeFor(variant, label);
  const palette = colorPalette ?? (shape === 'link' ? 'accent' : 'muted');
  const isInactive = disabled || loading;
  if (__DEV__) warnOnce(combinationProblem({ variant, icon, label, isInverse, palette }));

  const color = contentColor({ variant, palette, isSelected, isInverse });
  const iconSize = variant === 'overlay' ? OVERLAY_ICON_SIZE : size === 'small' ? sizes.iconSmall : sizes.icon;
  const defaultHitSlop = shape === 'link' ? 8 : variant === 'overlay' ? OVERLAY_HIT_SLOP : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      hitSlop={hitSlop ?? defaultHitSlop}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading, [isSwitch ? 'checked' : 'selected']: isSelected }}
      style={({ pressed }) => [
        styles[shape],
        shape === 'block' && styles[`block_${size}`],
        shape === 'link' && size === 'small' && styles.linkSmall,
        shape === 'disc' && discBackground({ variant, palette, isSelected, pressed: pressed && !isInactive }),
        variant === 'overlay' && styles.overlayDisc,
        pressed && !isInactive && pressedStyle(shape, variant),
        isInactive && styles.disabled,
        style,
      ]}
    >
      {shape === 'block' ? (
        <GradientFill style={[styles.blockFill, size === 'small' && styles.blockFillSmall]}>
          <Content {...{ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }} />
        </GradientFill>
      ) : variant === 'primary' ? (
        <GradientFill style={styles.discFill}>
          <Content {...{ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }} />
        </GradientFill>
      ) : (
        <Content {...{ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }} />
      )}
    </Pressable>
  );
}

// A link is a tertiary with a label, a block a primary with one; every other button is a 44 pt disc.
function shapeFor(variant, label) {
  if (!label) return 'disc';
  if (variant === 'tertiary') return 'link';
  if (variant === 'primary') return 'block';
  return 'disc';
}

function Content({ icon, label, loading, color, iconSize, filled, iconCount, shape, size, palette }) {
  // A link keeps its label and swaps its icon for the spinner; every other button shows only the spinner.
  const spinner = <ActivityIndicator size="small" color={color} />;
  if (loading && shape !== 'link') return spinner;
  if (shape === 'disc' && label) return <Text style={[styles.discLabel, { color }]}>{label}</Text>;
  if (shape === 'disc' && iconCount === 2) {
    return (
      <View style={styles.pair}>
        <Icon name={icon} size={PAIR_ICON_SIZE} color={color} filled={filled} />
        <Icon name={icon} size={PAIR_ICON_SIZE} color={color} filled={filled} />
      </View>
    );
  }
  if (shape === 'disc') return <Icon name={icon} size={iconSize} color={color} filled={filled} />;

  const isSmall = size === 'small';
  const linkIconSize = isSmall ? scale(14) : scale(16);
  return (
    <>
      {loading
        ? spinner
        : icon && <Icon name={icon} size={shape === 'link' ? linkIconSize : sizes.icon} color={color} />}
      <Text
        style={[
          shape === 'link' ? styles.linkLabel : styles.blockLabel,
          isSmall && (shape === 'link' ? styles.linkLabelSmall : styles.blockLabelSmall),
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
  if (variant === 'primary' || variant === 'overlay') return colors.text.inverse;
  if (variant === 'secondary' && palette === 'danger') return colors.text.inverse;
  if (isSelected) return palette === 'favorite' ? colors.status.danger : colors.accent.base;
  if (isInverse) return INVERSE_PALETTE[palette];
  return PALETTE[palette];
}

function discBackground({ variant, palette, isSelected, pressed }) {
  if (variant === 'primary') return null;
  if (variant === 'overlay') return styles.overlayFill;
  if (variant === 'secondary' && palette === 'danger') return styles.dangerFill;
  if (isSelected && palette !== 'favorite') return styles.selectedFill;
  if (variant === 'secondary') return styles.mutedFill;
  if (pressed) return palette === 'danger' ? styles.dangerTint : styles.mutedFill;
  return null;
}

// A tertiary disc tints behind it (discBackground); everything filled dims and shrinks; a link fades.
function pressedStyle(shape, variant) {
  if (shape === 'link') return press.flat;
  if (variant === 'tertiary') return null;
  return press.filled;
}

// Why these props make no button the app has, or null.
function combinationProblem({ variant, icon, label, isInverse, palette }) {
  if (!icon && !label) return 'Button: needs an icon or a label';
  if (variant === 'secondary' && icon && label) return 'Button: a secondary shows an icon or a label, not both';
  if (variant === 'overlay' && (label || !icon)) return 'Button: an overlay shows an icon only';
  if (variant === 'secondary' && label?.length > MAX_DISC_LABEL) {
    return `Button: "${label}" is too long for a secondary's disc; use a Chip`;
  }
  if (isInverse && !INVERSE_PALETTE[palette]) return `Button: no "${palette}" on a dark surface`;
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
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedFill: {
    backgroundColor: colors.overlay.pressed,
  },
  overlayDisc: {
    width: sizes.overlayButton,
    height: sizes.overlayButton,
  },
  overlayFill: {
    backgroundColor: colors.overlay.dim,
  },
  selectedFill: {
    backgroundColor: colors.accent.light,
  },
  dangerFill: {
    backgroundColor: colors.status.danger,
  },
  dangerTint: {
    backgroundColor: colors.status.dangerLight,
  },
  discLabel: {
    fontSize: typography.footnote,
    fontWeight: '700',
  },
  pair: {
    flexDirection: 'row',
    gap: 2,
  },
  block: {
    overflow: 'hidden',
  },
  block_regular: {
    height: sizes.primaryButton,
    borderRadius: radii.card,
  },
  block_small: {
    height: sizes.iconButton,
    borderRadius: radii.pill,
  },
  blockFill: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingHorizontal: scale(20),
  },
  blockFillSmall: {
    paddingHorizontal: scale(16),
  },
  blockLabel: {
    fontSize: typography.callout,
    fontWeight: '600',
  },
  blockLabelSmall: {
    fontSize: typography.subheadline,
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
