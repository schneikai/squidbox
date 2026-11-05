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

// Raw values, each defined once.
const palette = {
  white: '#FFFFFF',
  black: '#000000',
  gray75: '#F2F2F5', // the page's soft gray, a hair from iOS's grouped #F2F2F7
  gray60: '#F5F5F8',
  gray100: '#F0F0F0',
  gray300: '#D3D3D3',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray900: '#111827',
  violet50: '#F5F3FF',
  violet75: '#EFEDF8', // the page gray with a touch of lavender
  violet100: '#EFE7FD',
  violet250: '#C4AAFF', // light and saturated, the rim light on the violet
  violet300: '#C4B5FD',
  violet600: '#7C3AED',
  violet650: '#6640E9', // between violet600 and indigo600
  indigo600: '#4F46E5',
  violet900: '#2E108C', // dark and saturated, the shade on the violet
  rose600: '#E11D48',
  green500: '#34C759',
  blue600: '#2563EB',
  cyan100: '#B1F1FF',
  yellow100: '#FEF6C7',
};

// Semantic roles, grouped by what they paint. To add a color, add its raw value to `palette` and
// name it here by purpose.
export const colors = {
  text: {
    primary: palette.gray900,
    secondary: palette.gray500, // details, inactive icons
    tertiary: palette.gray400, // placeholders and disabled text only, too faint for copy
    inverse: palette.white, // text and marks on the accent, danger, dark overlays or pictures
  },
  accent: {
    base: palette.violet600,
    light: alpha(palette.violet600, 0.12),
    surface: palette.violet100, // `light` over white, opaque for a surface over content (the account avatar)
    border: alpha(palette.violet600, 0.3), // the frame of an outlined or dashed chip
    onDark: palette.violet300, // the accent on a dark surface (the Undo bar's Undo)
    gradient: [palette.violet600, palette.indigo600],
    frame: palette.violet650, // the frame of a toolbar that is only the primary (FloatingPill), between the gradient's ends
    frameDisabled: alpha(palette.violet650, 0.4), // that frame while its button is off, faded like the button (disabledOpacity)
  },
  status: {
    success: palette.green500, // a confirmation that just happened (copied)
    successLight: alpha(palette.green500, 0.12),
    danger: palette.rose600,
    dangerLight: alpha(palette.rose600, 0.1),
    info: palette.blue600, // a neutral fact about an entry (a model is the Default)
    infoLight: alpha(palette.blue600, 0.12),
  },
  background: {
    // The page gradient: a soft gray, never white, so white cards (`surface`) stand clear of it.
    app: [palette.gray75, palette.gray60, palette.violet75],
    base: palette.gray75, // a sheet or screen without the gradient
    surface: palette.white, // opaque, for a surface over media that mustn't show it through
    glass: alpha(palette.white, 0.95),
    litGlass: alpha('#F6F6F8', 0.94), // a floating pill: a hair off-white, so its white rim shows
    menu: alpha(palette.white, 0.72), // tint over the BlurView of popover menus
    muted: palette.gray100, // `overlay.pressed` over white, opaque
    tint: palette.violet50, // a lavender card on a white sheet
    // The lavender tray of the assistant's actions (AssistantTray): the same violet as `tint` today,
    // but its own role, so the assistant's look can change without the cards that use `tint`
    assistant: palette.violet50,
    assistantClear: alpha(palette.violet50, 0), // `assistant` faded out, the end of a row that scrolls inside it
    note: palette.yellow100, // a sticky note's yellow (a model's note in its list, a WarningNote)
    placeholder: palette.gray300, // a picture's spot before it loads
    shimmer: palette.white, // the pulse over a loading picture's placeholder
    media: palette.black, // behind a photo or video shown full screen
    splash: palette.cyan100, // app.config.js `SPLASH_BACKGROUND` (the native splash's), for the boot screen
  },
  border: {
    glass: alpha(palette.black, 0.08),
    divider: alpha(palette.black, 0.08), // between the rows of a grouped list (Divider)
  },
  overlay: {
    pressed: alpha(palette.black, 0.06), // a pressed or highlighted row on a light surface
    dim: alpha(palette.black, 0.35), // under a badge over a picture, behind a small dialog
    scrim: alpha(palette.black, 0.8), // dims the whole app behind a blocking overlay
    track: alpha(palette.white, 0.1), // the empty part of a progress ring on the scrim
  },
};

export const shadows = {
  // Floating UI (toolbars, popovers): a wide, very soft shadow, as if lit softly from above
  floating: {
    boxShadow: `0 16px 56px ${alpha(palette.black, 0.12)}, 0 2px 12px ${alpha(palette.black, 0.06)}`,
  },
  // A card resting on the page: the same soft light, lower
  card: {
    boxShadow: `0 10px 40px ${alpha(palette.black, 0.05)}`,
  },
  // A chip lifted off its surface (the prompt buttons on the assistant's tray and over the chat's
  // composer); a row of them leaves `raisedShadowRoom` for it
  raised: {
    boxShadow: `0 2px 8px ${alpha(palette.violet900, 0.08)}`,
  },
  // A grid cell lifted under the finger while it's dragged
  lifted: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  // A small floating button on its own (the account avatar): a softer floating shadow
  subtle: {
    boxShadow: `0 10px 36px ${alpha(palette.black, 0.11)}, 0 1px 8px ${alpha(palette.black, 0.05)}`,
  },

  // The lit edge of a floating surface (FloatingPill, a popover), lit from the top left: a bright
  // rim along its top and left, a faint shade along its bottom and right, drawn inside its edge
  litEdge: {
    boxShadow: `inset 1.5px 1.5px 0 ${alpha(palette.white, 1)}, inset -1px -1px 0 ${alpha(palette.black, 0.06)}`,
  },
  // litEdge on the violet, in violets: white and black would read as a hard crescent and a gray line
  litEdgeAccent: {
    boxShadow: `inset 1.5px 1.5px 0 ${alpha(palette.violet250, 0.95)}, inset -1px -1px 0 ${alpha(palette.violet900, 0.85)}`,
  },
};

export const radii = {
  pill: 100,
  card: 16,
  cover: 10, // album covers and the thumbnails of list rows (CoverImage)
  modal: 20,
  badge: 6, // a small label inside content (Badge)
};

// The geometry of the app's chrome: gutters, bar and menu paddings, the space content keeps clear
// of the floating bars.
export const layout = {
  sideGutter: SIDE_GUTTER,
  barBottom: scale(16), // between the bottom bars and the home indicator's safe area
  barPaddingX: scale(8),
  barPaddingY: scale(6),
  toolbarFrame: 3, // the glass frame around a toolbar's buttons, its lit rim inside it (FloatingPill)
  contentTop: scale(88), // clears the floating header
  contentBottom: scale(128), // clears the floating bottom bars
  popoverGap: 25, // between a trigger button and the popover that opens from it
  introGap: 12, // between a screen's intro text (IntroText at its top) and the content below it
  actionsGap: 24, // between a screen's content and its text actions under it (ActionButtons)
  menuRowPaddingX: scale(16),
  menuRowPaddingY: scale(13),
  menuIconGap: scale(12), // between a menu row's leading icon and its label
};

// Fixed sizes of controls and icons; they scale with the screen like everything else.
export const sizes = {
  iconButton: scale(44), // Apple's minimum tap target, and a regular Button's height (discs and pills)
  smallButton: scale(28), // a small Button's height (`size="small"`, discs and pills); hitSlop keeps the 44 pt target
  icon: scale(20), // inside a button
  iconSmall: scale(18), // compact: avatars, secondary indicators
  iconLarge: scale(32), // stands for content (a not-uploaded thumbnail)
  menuIcon: scale(16),
  captionIcon: scale(14), // beside a caption (a post card's thread mark)
  // Fits typical labels on one line, never wider than the screen minus the side gutters.
  popoverWidth: Math.min(scale(230), SCREEN_WIDTH - 2 * SIDE_GUTTER),
};

// Apple's iOS text styles at their default (Large) sizes, so text keeps the HIG's hierarchy.
export const typography = {
  caption2: scale(11), // the smallest text: badges over thumbnails
  caption: scale(12), // secondary details under a title (counts, dates)
  footnote: scale(13),
  subheadline: scale(15),
  callout: scale(16),
  body: scale(17), // the default for text and inputs
  title2: scale(22),
  title1: scale(28),
};

// The line height of each text style, for text that can wrap. `reading` is looser, for long text
// someone reads or writes (a post, a note).
export const lineHeights = {
  caption2: scale(13),
  footnote: scale(18),
  subheadline: scale(20),
  reading: scale(24),
};

export const glass = {
  backgroundColor: colors.background.glass,
  borderColor: colors.border.glass,
  borderWidth: 1,
};

// A floating pill's glass: no border, its lit edge (shadows.litEdge) draws the rim inside it
export const litGlass = {
  backgroundColor: colors.background.litGlass,
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
  settle: springConfig({ duration: 0.38, bounce: 0 }), // settles after a tap or a slow release, without overshoot
  pulse: { duration: 1000, easing: Easing.inOut(Easing.sin) }, // one half of a loading placeholder's breath
  shoot: { easing: Easing.bezierFn(0.1, 0.6, 0.7, 0.75) }, // shoots off and slows, still moving when it ends
};

// How a pressable answers a touch: a filled one (a disc, the violet action) dims and shrinks a
// little, a flat one (a text link) fades. A flat icon button tints behind it (`overlay.pressed`).
// The room a row of `shadows.raised` chips leaves above and below them (PromptButtonRow), taken back
// so the row stays the chips' height: the whole shadow (2 pt down, 8 pt blur), so none of it is cut off.
export const raisedShadowRoom = scale(10);

export const press = {
  filled: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  flat: { opacity: 0.6 },
};

// A control that can't be used right now.
export const disabledOpacity = 0.4;

// Apple's spring model (WWDC23 "Animate with springs"): perceptual duration in seconds and bounce
// (0 = none), as the physics values both Animated.spring and Reanimated's withSpring take.
function springConfig({ duration, bounce }) {
  return {
    mass: 1,
    stiffness: ((2 * Math.PI) / duration) ** 2,
    damping: (4 * Math.PI * (1 - bounce)) / duration,
  };
}

function alpha(hex, opacity) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${opacity})`;
}
