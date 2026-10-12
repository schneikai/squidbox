import { BlurView } from 'expo-blur';
import React from 'react';
import { Animated, I18nManager, StyleSheet, View } from 'react-native';

import { colors, motion, radii, shadows, spacing } from '@/styles/designTokens';

/**
 * Custom react-native-popup-menu renderer.
 *
 * Positions the menu below the trigger (flips above when there is insufficient
 * space) with a small gap, using BlurView + a light overlay for the frosted-glass
 * appearance that matches the sort/filter panel. It opens by growing out of the
 * trigger's corner with a soft spring and shrinks back into it on close.
 *
 * The renderer interface requires:
 *   - render()  — must apply the computed position to the outermost View
 *   - close()   — returns a Promise that resolves after the exit animation
 *   - static computePosition(layouts, isRTL) — called by the library to determine
 *     the container size before rendering (used for flip logic)
 */

const HORIZONTAL_NUDGE = 4; // px extra rightward shift when right-aligned

/**
 * Same axis-position logic used by the built-in ContextMenu renderer:
 *   • If the menu fits starting at the trigger's near edge → left-align
 *   • If it would overflow → right-align (menu right = trigger right)
 *   • Otherwise → center on the trigger
 */
function axisPosition(oDim, wDim, tPos, tDim) {
  if (oDim > wDim) return 0;
  if (tPos + oDim <= wDim) return tPos;
  if (tPos + tDim - oDim >= 0) return tPos + tDim - oDim;
  const pos = Math.round(tPos + tDim / 2 - oDim / 2);
  if (pos < 0) return 0;
  if (pos + oDim > wDim) return wDim - oDim;
  return pos;
}

// Where the menu goes, and which side of the trigger it is anchored to.
function computePlacement(layouts) {
  const { windowLayout, triggerLayout, optionsLayout } = layouts;
  const { x: wX, y: wY, width: wWidth, height: wHeight } = windowLayout;
  const { x: tX, y: tY, height: tHeight, width: tWidth } = triggerLayout;
  const { height: oHeight, width: oWidth } = optionsLayout;

  // Horizontal — left-aligns to trigger, right-aligns when it would overflow.
  // A small rightward nudge is applied when right-aligned so the menu sits
  // slightly past the trigger's right edge for visual breathing room.
  const rawLeft = axisPosition(oWidth, wWidth, tX - wX, tWidth);
  const isRightAligned = rawLeft < tX - wX; // flipped to right-align
  const left = isRightAligned ? rawLeft + HORIZONTAL_NUDGE : rawLeft;

  // Vertical — open below trigger, flip above when there is no room
  const belowTop = tY - wY + tHeight + spacing.popoverGap;
  const aboveTop = tY - wY - oHeight - spacing.popoverGap;
  const opensBelow = belowTop + oHeight <= wHeight;
  const top = opensBelow ? belowTop : Math.max(0, aboveTop);

  return { top, left, isRightAligned, opensBelow };
}

function computePosition(layouts, isRTL) {
  const { top, left } = computePlacement(layouts);
  const start = isRTL ? 'right' : 'left';
  return { top, [start]: left };
}

// The menu's corner nearest the trigger, so it grows out of (and shrinks back into) the button.
function transformOriginFor({ isRightAligned, opensBelow }, isRTL) {
  const vertical = opensBelow ? 'top' : 'bottom';
  const alignedToEnd = isRightAligned !== isRTL;
  return `${vertical} ${alignedToEnd ? 'right' : 'left'}`;
}

export default class BlurPopoverRenderer extends React.Component {
  constructor(props) {
    super(props);
    this.state = { anim: new Animated.Value(0) };
  }

  componentDidMount() {
    Animated.spring(this.state.anim, { toValue: 1, ...motion.spring, useNativeDriver: true }).start();
  }

  close() {
    return new Promise((resolve) => {
      Animated.timing(this.state.anim, { toValue: 0, ...motion.exit, useNativeDriver: true }).start(resolve);
    });
  }

  render() {
    // Spread `...other` so the library's onLayout (used to measure the
    // options container for positioning) reaches the underlying View.
    const { children, layouts, style, ...other } = this.props;
    const position = computePosition(layouts, I18nManager.isRTL);

    const animatedStyle = {
      opacity: this.state.anim.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
      transformOrigin: transformOriginFor(computePlacement(layouts), I18nManager.isRTL),
      transform: [{ scale: this.state.anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
    };

    return (
      <Animated.View {...other} style={[styles.container, style, position, animatedStyle]}>
        <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />
        {children}
      </Animated.View>
    );
  }
}

BlurPopoverRenderer.computePosition = computePosition;

const styles = StyleSheet.create({
  // Size-affecting styles (min width, padding, border) come from popupMenuStyles.menuOptions so the
  // library measures the same box that is drawn here.
  container: {
    position: 'absolute',
    borderRadius: radii.modal,
    overflow: 'hidden',
    ...shadows.floating,
  },
  overlay: {
    backgroundColor: colors.menuOverlay,
  },
});
