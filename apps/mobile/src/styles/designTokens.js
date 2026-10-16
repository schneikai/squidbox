import { Dimensions } from 'react-native';
import { Easing } from 'react-native-reanimated';

const BASE_WIDTH = 390; // iPhone 14 Pro — design baseline
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE_FACTOR = SCREEN_WIDTH / BASE_WIDTH;

/**
 * Scale a size proportionally to screen width, clamped to a safe range.
 * Base value is designed for a 390 pt wide screen (iPhone 14 Pro).
 * Typical results: SE (375) → ~0.96×, Pro Max (430) → ~1.10×
 *
 * @param {number} size   Base size in points
 * @param {number} [min=0.85]  Minimum scale factor
 * @param {number} [max=1.15]  Maximum scale factor
 */
export const scale = (size, min = 0.85, max = 1.15) => Math.round(size * Math.min(Math.max(SCALE_FACTOR, min), max));

// Horizontal gutter between floating UI (bars, popovers) and the screen edges.
const SIDE_GUTTER = scale(16);

export const colors = {
  gradientStart: '#7C3AED',
  gradientEnd: '#4F46E5',
  appBackground: ['#F9FAFB', '#FFFFFF', '#F5F3FF'],
  splashBackground: '#B1F1FF', // app.config.js `SPLASH_BACKGROUND` (the native splash's), for the boot screen

  glassSurface: 'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(0,0,0,0.08)',

  // Popover menus and the sort/filter panel: a light frosted surface.
  menuOverlay: 'rgba(255,255,255,0.72)', // tint layer on top of the light BlurView
  menuBorder: 'rgba(0,0,0,0.08)',
  menuText: '#111827',
  menuTextDim: '#6B7280',

  accent: '#7C3AED',
  accentLight: 'rgba(124,58,237,0.12)',

  danger: '#E11D48',
  dangerLight: 'rgba(225,29,72,0.1)',

  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  iconInactive: '#6B7280',
  iconActive: '#FFFFFF',

  separator: 'rgba(255,255,255,0.1)',

  // Interactive states
  pressedBg: 'rgba(0,0,0,0.06)', // subtle press overlay on light surfaces
  menuHover: 'rgba(0,0,0,0.05)', // highlighted row on menu surfaces

  // Generic overlays for thumbnail badges etc.
  overlayDark: 'rgba(0,0,0,0.35)',
};

export const shadows = {
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  accent: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const radii = {
  pill: 100,
  card: 16,
  modal: 20,
  icon: 40,
};

export const spacing = {
  floatingBarSide: SIDE_GUTTER,
  floatingBarBottom: scale(16),
  iconButtonSize: scale(44), // 44pt baseline (Apple HIG minimum tap target), scales with screen
  iconSize: scale(20), // standard icon inside a button (~45% of button size)
  iconSizeSmall: scale(18), // compact icon (avatar, secondary indicators)
  barPaddingX: scale(8),
  barPaddingY: scale(6),
  contentPaddingTop: scale(88),
  contentPaddingBottom: scale(128),

  // Popup / popover menu rows
  menuFontSize: scale(14),
  menuRowH: scale(16), // horizontal padding inside each row
  menuRowV: scale(13), // vertical padding inside each row
  menuIconSize: scale(16),
  menuIconGap: scale(12), // gap between leading icon and label text

  // Gap between a trigger button and the popover that opens from it
  popoverGap: 25,
  // Fixed popover menu width: fits typical labels on one line, never wider than the screen
  // minus the side gutters.
  popoverWidth: Math.min(scale(230), SCREEN_WIDTH - 2 * SIDE_GUTTER),
};

export const typography = {
  xs: scale(11),
  sm: scale(13),
  base: scale(17),
  lg: scale(20),
  xl: scale(24),
  xxl: scale(28),
  // Semantic token — used for all text inputs (search, notes, post text, etc.)
  input: scale(17),
};

export const glass = {
  backgroundColor: colors.glassSurface,
  borderColor: colors.glassBorder,
  borderWidth: 1,
};

const durations = { fast: 150, base: 250 };

// Motion: a small fixed set, so every transition in the app feels alike. Reanimated's easings are
// worklets, so they also run in React Native's Animated.
export const motion = {
  duration: durations,
  enter: { duration: durations.base, easing: Easing.out(Easing.cubic) }, // appears, decelerating into place
  exit: { duration: durations.fast, easing: Easing.in(Easing.cubic) }, // leaves, shorter and accelerating away
  move: { duration: durations.base, easing: Easing.inOut(Easing.cubic) }, // changes while staying on screen
  spring: springConfig({ duration: 0.3, bounce: 0.15 }), // anything that grows, follows a finger or settles
  pulse: { duration: 1000, easing: Easing.inOut(Easing.sin) }, // one half of a loading placeholder's breath
  shoot: { easing: Easing.bezierFn(0.1, 0.6, 0.7, 0.75) }, // shoots off and slows, still moving when it ends
};

// Apple's spring model (WWDC23 "Animate with springs"): perceptual duration in seconds and bounce
// (0 = none), as the physics values both Animated.spring and Reanimated's withSpring take.
function springConfig({ duration, bounce }) {
  return {
    mass: 1,
    stiffness: ((2 * Math.PI) / duration) ** 2,
    damping: (4 * Math.PI * (1 - bounce)) / duration,
  };
}
