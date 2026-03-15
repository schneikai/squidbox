import { Dimensions } from 'react-native';

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
export const scale = (size, min = 0.85, max = 1.15) =>
  Math.round(size * Math.min(Math.max(SCALE_FACTOR, min), max));

export const colors = {
  gradientStart: '#7C3AED',
  gradientEnd: '#4F46E5',
  appBackground: ['#F9FAFB', '#FFFFFF', '#F5F3FF'],

  glassSurface: 'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(0,0,0,0.08)',

  darkModal: 'rgba(17,17,17,0.95)',
  darkModalOverlay: 'rgba(10,10,10,0.55)', // tint layer on top of BlurView
  darkModalBorder: 'rgba(255,255,255,0.10)',
  darkModalText: 'rgba(255,255,255,0.95)',
  darkModalTextDim: 'rgba(255,255,255,0.55)',

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
  pressedBg: 'rgba(0,0,0,0.06)',       // subtle press overlay on light surfaces
  darkModalHover: 'rgba(255,255,255,0.08)', // highlighted row on dark modal surfaces
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
  floatingBarSide: scale(16),
  floatingBarBottom: scale(16),
  iconButtonSize: scale(44),   // 44pt baseline (Apple HIG minimum tap target), scales with screen
  iconSize: scale(20),         // standard icon inside a button (~45% of button size)
  iconSizeSmall: scale(18),    // compact icon (avatar, secondary indicators)
  barPaddingX: scale(8),
  barPaddingY: scale(6),
  contentPaddingTop: scale(88),
  contentPaddingBottom: scale(128),

  // Popup / popover menu rows
  menuFontSize: scale(14),
  menuRowH: scale(16),   // horizontal padding inside each row
  menuRowV: scale(13),   // vertical padding inside each row
  menuIconSize: scale(16),
  menuIconGap: scale(12), // gap between leading icon and label text

  // Gap between a trigger button and the popover that opens from it
  popoverGap: 25,
};

export const typography = {
  xs:   scale(11),
  sm:   scale(13),
  base: scale(17),
  lg:   scale(20),
  xl:   scale(24),
  xxl:  scale(28),
};

export const glass = {
  backgroundColor: colors.glassSurface,
  borderColor: colors.glassBorder,
  borderWidth: 1,
};
