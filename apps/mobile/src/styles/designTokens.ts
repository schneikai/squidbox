import { Dimensions, type TextStyle } from 'react-native';
import { Easing, LinearTransition } from 'react-native-reanimated';

const BASE_WIDTH = 390; // iPhone 14 Pro — design baseline
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE_FACTOR = SCREEN_WIDTH / BASE_WIDTH;

/**
 * Scale a size proportionally to screen width, clamped to a safe range.
 * Base value is designed for a 390 pt wide screen (iPhone 14 Pro).
 * Typical results: SE (375) → ~0.96×, Pro Max (430) → ~1.10×
 *
 * @param size   Base size in points
 * @param [min=0.85]  Minimum scale factor
 * @param [max=1.15]  Maximum scale factor
 */
export const scale = (size: number, min = 0.85, max = 1.15) =>
  Math.round(size * Math.min(Math.max(SCALE_FACTOR, min), max));

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
  gray600: '#4B5563',
  gray900: '#111827',
  violet50: '#F5F3FF',
  violet75: '#EFEDF8', // the page gray with a touch of lavender
  violet85: '#EAE5F8', // the page gray with 7% violet, so a lavender surface on the page still reads
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
  amber500: '#F59E0B',
};

// Semantic roles, grouped by what they paint. To add a color, add its raw value to `palette` and
// name it here by purpose.
export const colors = {
  text: {
    primary: palette.gray900,
    secondary: palette.gray500, // details, inactive icons
    muted: palette.gray600, // details on a grey or yellow fill, where `secondary` would fade ("+3", a duplicate's reason)
    tertiary: palette.gray400, // placeholders and disabled text only, too faint for copy
    inverse: palette.white, // text and marks on the accent, danger, dark overlays or pictures
  },
  accent: {
    base: palette.violet600,
    light: alpha(palette.violet600, 0.12),
    surface: palette.violet100, // `light` over white, opaque for a surface over content (the account avatar)
    border: alpha(palette.violet600, 0.3), // the thread's connector line
    onDark: palette.violet300, // the accent on a dark surface (the Undo bar's Undo)
    gradient: [palette.violet600, palette.indigo600] as const,
    frame: palette.violet650, // the frame of a toolbar that is only the primary (FloatingPill), between the gradient's ends
  },
  status: {
    success: palette.green500, // a confirmation that just happened (copied)
    successLight: alpha(palette.green500, 0.12),
    danger: palette.rose600,
    dangerLight: alpha(palette.rose600, 0.1),
    info: palette.blue600, // a neutral fact about an entry (a model is the Default)
    infoLight: alpha(palette.blue600, 0.12),
    warning: palette.amber500, // a mark on what a warning is about (a field a duplicate contact shares)
  },
  background: {
    // The page gradient: a soft gray, never white, so white cards (`surface`) stand clear of it.
    app: [palette.gray75, palette.gray60, palette.violet75] as const,
    base: palette.gray75, // a sheet or screen without the gradient
    surface: palette.white, // opaque, for a surface over media that mustn't show it through
    glass: alpha(palette.white, 0.95),
    litGlass: alpha('#F6F6F8', 0.94), // a floating pill: a hair off-white, so its white rim shows
    menu: alpha(palette.white, 0.72), // tint over the BlurView of popover menus
    muted: palette.gray100, // `overlay.pressed` over white, opaque
    fill: alpha(palette.black, 0.06), // a tag chip's see-through fill: a shade darker than the white or grey behind it
    tint: palette.violet50, // a lavender card on a white sheet
    // The lavender tray of the assistant's actions (AssistantTray): a step deeper than the page, so it
    // stands out on the page and in a white card alike
    assistant: palette.violet85,
    assistantClear: alpha(palette.violet85, 0), // `assistant` faded out, the end of a row that scrolls inside it
    note: palette.yellow100, // a sticky note's yellow (a model's note in its list, a WarningNote)
    placeholder: palette.gray300, // a picture's spot before it loads
    shimmer: palette.white, // the pulse over a loading picture's placeholder
    media: palette.black, // behind a photo or video shown full screen
    splash: palette.cyan100, // app.config.js `SPLASH_BACKGROUND` (the native splash's), for the boot screen
  },
  border: {
    glass: alpha(palette.black, 0.08),
    divider: alpha(palette.black, 0.08), // between the rows of a grouped list (Divider)
    dashed: alpha(palette.black, 0.2), // the dashed frame of an Add chip
  },
  overlay: {
    pressed: alpha(palette.black, 0.06), // a pressed or highlighted row on a light surface
    menuGap: alpha(palette.black, 0.05), // the band between groups of a popover menu's rows (Divider)
    dim: alpha(palette.black, 0.35), // under a badge over a picture, behind a small dialog
    scrim: alpha(palette.black, 0.8), // dims the whole app behind a blocking overlay
    track: alpha(palette.white, 0.1), // the empty part of a progress ring on the scrim
  },
};

// `shadows.raised`: how far down it falls and how far it blurs.
// eslint-disable-next-line no-restricted-syntax -- a shadow's offset in px, not a spacing
const RAISED_OFFSET = 2;
const RAISED_BLUR = 8;

// The lit edge of a surface, drawn inside it: a `light` rim along its top and left, a `shade` along
// its bottom and right.
function litEdge(light: string, shade: string) {
  return { boxShadow: `inset 1.5px 1.5px 0 ${light}, inset -1px -1px 0 ${shade}` };
}

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
    boxShadow: `0 ${RAISED_OFFSET}px ${RAISED_BLUR}px ${alpha(palette.violet900, 0.08)}`,
  },
  // A grid cell lifted under the finger while it's dragged
  lifted: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  // A thumb raised off the toolbar it sits in (the active text segment of a SegmentedPill)
  thumb: {
    boxShadow: `0 2px 8px ${alpha(palette.black, 0.08)}`,
  },
  // A picture raised off the page (the contact screen's avatar)
  avatar: {
    boxShadow: `0 10px 40px ${alpha(palette.black, 0.12)}`,
  },
  // A small floating button on its own (the account avatar): a softer floating shadow
  subtle: {
    boxShadow: `0 10px 36px ${alpha(palette.black, 0.11)}, 0 1px 8px ${alpha(palette.black, 0.05)}`,
  },

  // The lit edge of a floating surface (FloatingPill, a popover), lit from the top left: a bright
  // rim along its top and left, a faint shade along its bottom and right, drawn inside its edge
  litEdge: litEdge(alpha(palette.white, 1), alpha(palette.black, 0.06)),
  // litEdge on a lavender surface (the assistant's tray): its shaded edge in violet, not gray
  litEdgeTint: litEdge(alpha(palette.white, 0.9), alpha(palette.violet600, 0.08)),
  // litEdge on the violet, in violets: white and black would read as a hard crescent and a gray line
  litEdgeAccent: litEdge(alpha(palette.violet250, 0.95), alpha(palette.violet900, 0.85)),
};

// The room a row of `shadows.raised` chips leaves above and below them (PromptButtonRow), taken back
// so the row stays the chips' height: the whole shadow, which reaches its blur less its offset above
// the chip and its blur plus its offset below, so none of it is cut off.
export const raisedShadowRoom = { top: RAISED_BLUR - RAISED_OFFSET, bottom: RAISED_BLUR + RAISED_OFFSET };

// The spacing scale: every padding, margin, gap and offset is one of these steps or a layout role
// built from them, except the few that say on their line why they are not (an ESLint rule holds
// the line). The steps grow with the screen like the sizes do (scale()), so a phone's proportions
// hold; a sum of steps is written as the sum, so it says what it is made of.
export const space = {
  hair: scale(2), // a hair: a title from its subtitle line, the two halves of a paired button
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(24),
  xxxl: scale(32), // the breathing room of a status screen or an empty state
};

const SIDE_GUTTER = space.lg;
const CARD_INSET = space.lg;
const BAR_MARGIN = space.lg;
const OBJECT_INSET = space.md;
const POST_CARD_PADDING = OBJECT_INSET;
const CARD_RADIUS = 16;

// Fixed sizes of controls and icons; they scale with the screen like everything else.
export const sizes = {
  iconButton: scale(44), // Apple's minimum tap target, and a regular Button's height (discs and pills)
  smallButton: scale(28), // a small Button's height (`size="small"`, discs and pills); hitSlop keeps the 44 pt target
  icon: scale(20), // inside a button
  iconSmall: scale(18), // compact: avatars, secondary indicators
  iconLarge: scale(32), // stands for content (a not-uploaded thumbnail)
  menuIcon: scale(16), // beside a chip's label
  menuItemIcon: scale(22), // at the end of a popover menu's row (MenuItemContent)
  thumbnail: scale(72), // a list row's leading picture (ThumbnailRow)
  thumbnailSmall: scale(36), // a small leading picture: a pick row's, what a chat is about
  postTile: { width: scale(84), height: scale(112) }, // a post's picture as a row card's tile (PostRowCard)
  // A contact's avatar (ContactAvatar's sizes): a chip's, a duplicate's, a contact's or a list's row
  // (ContactRow, ContactListRows), the favorites row's and New contact's, the contact screen's.
  avatar: {
    chip: scale(32),
    compact: scale(36),
    row: scale(48),
    medium: scale(72),
    hero: scale(120),
  },
  // Fits typical labels on one line, never wider than the screen minus the side gutters.
  popoverWidth: Math.min(scale(250), SCREEN_WIDTH - 2 * SIDE_GUTTER),
};

const BAR_HEIGHT = sizes.iconButton + BAR_MARGIN * 2;

// What a spacing means, on the scale: cards, rows, tiles and the app's chrome take a role, never a
// step, so one kind of thing has one spacing everywhere.
export const layout = {
  sideGutter: SIDE_GUTTER, // the screen's gutter, around Apple's 16 pt compact-width margin
  cardInset: CARD_INSET, // a card's or a sheet's inset (Card `padded`)
  rowInset: space.lg, // a list row's text inset, and its divider's, header's, footer's and intro's
  cardGap: space.md, // between the parts of a card or the rows of a form
  // Objects on a card (pictures, chips, a tray's row) sit one step closer to its edge than text,
  // which starts at cardInset.
  objectInset: OBJECT_INSET,
  // Above and below a row of 44 pt controls at a card's end: with the row's 12 pt of room around its
  // 20 pt glyphs, they sit cardGap from the text and cardInset from the edge.
  controlRowSlack: space.xs,
  rowLeadingGap: space.md, // a row's leading thumbnail, icon or indicator from its text; a card's thumbnail header too
  rowPaddingY: space.lg, // a settings row's vertical padding
  rowPaddingYCompact: space.md, // a row beside a thumbnail, a small settings row, a log block, a pick row
  badgeInset: space.sm, // a badge from a tile's or a grid cell's corner (ThumbnailBadge `corner`)
  badgeInsetSmall: space.hair, // a badge from the corner of a small (36 pt) thumbnail
  capsulePaddingX: space.xs + space.hair, // a small label's capsule around its text (Badge, ThumbnailBadge)
  capsulePaddingY: space.hair,
  sectionGap: space.xl, // between a screen's sections
  iconGap: space.sm, // an icon from its label in a chip or a regular control
  iconGapSmall: space.xs, // an icon from its label in a small control, a link or a badge
  linkPaddingX: space.xxl, // a regular text link's side padding (Button); AddRow and PostedAtPicker undo it
  keyboardGap: space.md, // between the keyboard (or the safe area) and what sits on it (useKeyboardInset)
  gridGutter: 1, // the hairline between a grid's cells: a line, not a step
  barMargin: BAR_MARGIN, // a bar's room from the screen's edge, top or bottom (the safe area's), and a sheet header's
  barGap: space.lg, // between two pills in a bar
  barHeight: BAR_HEIGHT, // a floating bar's row with the room around it
  barClearance: BAR_HEIGHT + space.lg, // what content keeps free under the bottom bars
  barPaddingX: space.sm,
  barPaddingY: scale(6), // frames a toolbar's disc
  toolbarFrame: 3, // the glass frame around a toolbar's buttons, its lit rim inside it (FloatingPill)
  contentTop: scale(88), // clears the floating header
  contentBottom: scale(128), // clears the floating bottom bars
  sheetContentTop: BAR_HEIGHT + space.sm, // a sheet's content under its header (ModalHeader)
  contentEnd: space.lg, // what a screen's or a sheet's content keeps above the bottom safe area
  popoverGap: 25, // between a trigger button and the popover that opens from it
  introGap: space.md, // between a screen's intro text (IntroText at its top) and the content below it
  actionsGap: space.xxl, // between a screen's content and its text actions under it (ActionButtons)
  menuRowPaddingX: space.lg,
  menuRowHeight: scale(50), // a popover menu row's minHeight (popupMenuStyles), iOS's
  menuRowPaddingY: space.sm, // a menu row's text from its edge once a larger text size grows it
  menuIconGap: space.lg, // between a menu row's label and its icon at the end
  // A post's card (PostView, and a thread's following post, ThreadPost): its padding, the further inset
  // of its text on each side (so text starts at cardInset with or without photos) and below, and the
  // room between its photos and its text.
  postCardPadding: POST_CARD_PADDING,
  postTextInset: CARD_INSET - POST_CARD_PADDING,
  postTextBottom: space.xs,
  postCardGap: space.md, // the same as cardGap
};

export const radii = {
  pill: 100,
  card: CARD_RADIUS,
  cover: 10, // album covers and the thumbnails of list rows (CoverImage)
  postPicture: CARD_RADIUS - POST_CARD_PADDING, // a post card's pictures, concentric with the card's corner
  modal: 20,
  badge: 6, // a small label inside content (Badge)
  bubble: 18, // a chat bubble's corners
  bubbleTail: 4, // a chat bubble's corner on its sender's side, under the last line
};

// The sizes and line heights textStyles are built from. Text takes a textStyle, never these; they
// are exported for what is sized to text without being text (an icon on a text line, a slot one
// line tall, a time's room).
export const typography = {
  caption2: scale(11),
  footnote: scale(13),
  subheadline: scale(15),
  body: scale(17),
  title2: scale(22),
  title1: scale(28),
};

export const lineHeights = {
  caption2: scale(13),
  footnote: scale(18),
  subheadline: scale(20),
  body: scale(22),
  reading: scale(24), // looser, for long text someone reads or writes
  title2: scale(28),
  title1: scale(34),
};

// Apple's iOS text styles at their default (Large) sizes with their line heights: caption2,
// footnote, subheadline and body in regular and semibold, `reading` (body, looser) for long text
// someone reads or writes, and the two titles, bold. Every text in the app is one of these.
export const textStyles = {
  caption2: { fontSize: typography.caption2, lineHeight: lineHeights.caption2 }, // a log's details
  // a badge over a thumbnail, a toolbar's subtitle, a grid cell's label
  caption2Bold: { fontSize: typography.caption2, lineHeight: lineHeights.caption2, fontWeight: '600' },
  footnote: { fontSize: typography.footnote, lineHeight: lineHeights.footnote }, // a hint, a footer, a log line, a video's time
  // a field's or group's label, the caption under a post or an album, a small or disc button's label
  footnoteBold: { fontSize: typography.footnote, lineHeight: lineHeights.footnote, fontWeight: '600' },
  // a row's description, a menu row, a text link, an error
  subheadline: { fontSize: typography.subheadline, lineHeight: lineHeights.subheadline },
  // a button's label, a menu's header row, a toolbar title, the avatar's initial
  subheadlineBold: { fontSize: typography.subheadline, lineHeight: lineHeights.subheadline, fontWeight: '600' },
  body: { fontSize: typography.body, lineHeight: lineHeights.body }, // a list row's label and value, an input
  // a section header, a card's or empty state's title, the first-sync count
  bodyBold: { fontSize: typography.body, lineHeight: lineHeights.body, fontWeight: '600' },
  reading: { fontSize: typography.body, lineHeight: lineHeights.reading }, // a post, an answer, a note, a chat bubble's text
  title2: { fontSize: typography.title2, lineHeight: lineHeights.title2, fontWeight: '700' }, // a sheet's or status screen's title
  title1: { fontSize: typography.title1, lineHeight: lineHeights.title1, fontWeight: '700' }, // the main screens' header
} satisfies Record<string, TextStyle>;

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
  fill: { duration: durations.base / 2, easing: Easing.out(Easing.cubic) }, // content filling a card over half a move
  spring: springConfig({ duration: 0.3, bounce: 0.15 }), // anything that grows, follows a finger or settles
  settle: springConfig({ duration: 0.38, bounce: 0 }), // settles after a tap or a slow release, without overshoot
  pulse: { duration: 1000, easing: Easing.inOut(Easing.sin) }, // one half of a loading placeholder's breath
  shoot: { easing: Easing.bezierFn(0.1, 0.6, 0.7, 0.75) }, // shoots off and slows, still moving when it ends
};

// A layout transition in the move motion: views that make room or close a gap glide to their new place
// (the prompt buttons as one is dragged or deleted, the posts below a thread that unfolds).
export const reflow = LinearTransition.duration(motion.move.duration).easing(motion.move.easing);

// How a pressable answers a touch: a filled one (a disc, the violet action) dims and shrinks a
// little, a flat one (a text link) fades. A flat icon button tints behind it (`overlay.pressed`).
export const press = {
  filled: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  flat: { opacity: 0.6 },
};

// A control that can't be used right now.
export const disabledOpacity = 0.4;

// Apple's spring model (WWDC23 "Animate with springs"): perceptual duration in seconds and bounce
// (0 = none), as the physics values both Animated.spring and Reanimated's withSpring take.
function springConfig({ duration, bounce }: { duration: number; bounce: number }) {
  return {
    mass: 1,
    stiffness: ((2 * Math.PI) / duration) ** 2,
    damping: (4 * Math.PI * (1 - bounce)) / duration,
  };
}

function alpha(hex: string, opacity: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${opacity})`;
}
