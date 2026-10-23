import React from 'react';
import { Animated, I18nManager } from 'react-native';

import PopoverSurface from './PopoverSurface';

import { layout, motion } from '@/styles/designTokens';

/**
 * Custom react-native-popup-menu renderer.
 *
 * Positions the menu below the trigger (flips above when there is insufficient
 * space) with a small gap, on the same PopoverSurface as the sort/filter panel.
 * It opens by growing out of the trigger's corner with a soft spring and shrinks
 * back into it on close.
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
  const belowTop = tY - wY + tHeight + layout.popoverGap;
  const aboveTop = tY - wY - oHeight - layout.popoverGap;
  const opensBelow = belowTop + oHeight <= wHeight;
  const top = opensBelow ? belowTop : Math.max(0, aboveTop);

  return { top, left, isRightAligned, opensBelow };
}

function positionFor({ top, left }, isRTL) {
  return { top, [isRTL ? 'right' : 'left']: left };
}

function computePosition(layouts, isRTL) {
  return positionFor(computePlacement(layouts), isRTL);
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
    const placement = computePlacement(layouts);
    const position = positionFor(placement, I18nManager.isRTL);
    const origin = transformOriginFor(placement, I18nManager.isRTL);

    // Size-affecting styles come in through `style` (popupMenuStyles.menuOptions), so the library
    // measures the same box that is drawn here.
    return (
      <PopoverSurface {...other} progress={this.state.anim} origin={origin} style={[style, position]}>
        {children}
      </PopoverSurface>
    );
  }
}

BlurPopoverRenderer.computePosition = computePosition;
