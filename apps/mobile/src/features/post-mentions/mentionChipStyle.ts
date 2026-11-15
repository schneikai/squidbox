/**
 * A mention chip's measures, in points, the one source for the native field's chips (MentionInput,
 * which draws them in Swift) and the read-only ones (MentionChip), so its look changes without a
 * build. `height` 0 is the text's line, `offsetY` moves it up from centered on the text, `labelSize`
 * 0 is the text's size, a `radius` under 0 a pill.
 */
export type MentionChipStyle = {
  height: number;
  avatarInset: number;
  labelGap: number;
  trailing: number;
  offsetY: number;
  labelSize: number;
  radius: number;
};

export const mentionChipStyle: MentionChipStyle = {
  height: 0,
  avatarInset: 2,
  labelGap: 5,
  trailing: 9,
  offsetY: 0,
  labelSize: 0,
  radius: -1,
};

/** A chip's sizes for text of `fontSize` with lines `lineHeight` tall, as the native field works them out. */
export type MentionChipBox = {
  height: number;
  avatar: number;
  inset: number;
  gap: number;
  trailing: number;
  labelSize: number;
  radius: number;
};

/**
 * `mentionChipStyle` resolved for a text's size, as MentionInputView.swift's `chipImage` does it: a
 * height of 0 is the font's line (about 1.2 times its size), the avatar fills the height less its
 * inset on each side, a labelSize of 0 is the text's, a radius under 0 makes a pill.
 */
export function mentionChipBox(fontSize: number, style: MentionChipStyle = mentionChipStyle): MentionChipBox {
  const height = style.height > 0 ? style.height : Math.ceil(fontSize * FONT_LINE);
  return {
    height,
    avatar: Math.max(height - style.avatarInset * 2, 0),
    inset: style.avatarInset,
    gap: style.labelGap,
    trailing: style.trailing,
    labelSize: style.labelSize > 0 ? style.labelSize : fontSize,
    radius: style.radius >= 0 ? style.radius : height / 2,
  };
}

// The system font's line for its size (UIFont.lineHeight / pointSize).
const FONT_LINE = 1.2;
