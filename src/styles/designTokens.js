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
  floatingBarSide: 16,
  floatingBarBottom: 16,
  iconButtonSize: 40,
  barPaddingX: 8,
  barPaddingY: 6,
  contentPaddingTop: 80,
  contentPaddingBottom: 120,

  // Popup / popover menu rows
  menuRowH: 16,     // horizontal padding inside each row
  menuRowV: 13,     // vertical padding inside each row
  menuIconSize: 16,
  menuIconGap: 12,  // gap between leading icon and label text

  // Gap between a trigger button and the popover that opens from it
  popoverGap: 25,
};

export const glass = {
  backgroundColor: colors.glassSurface,
  borderColor: colors.glassBorder,
  borderWidth: 1,
};
