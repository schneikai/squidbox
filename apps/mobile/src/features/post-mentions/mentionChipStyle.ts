/**
 * A mention chip's measures, in points, the one source for the native field's chips (MentionInput,
 * which draws them in Swift) and the read-only ones (MentionChip), so its look changes without a
 * build: the space around the avatar, from the avatar to the label, and after the label.
 */
export type MentionChipStyle = {
  avatarInset: number;
  labelGap: number;
  trailing: number;
};

export const mentionChipStyle: MentionChipStyle = {
  avatarInset: 2,
  labelGap: 5,
  trailing: 9,
};

/** A chip's sizes for text of `fontSize`, as the native field works them out. */
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
 * `mentionChipStyle` resolved for a text's size, as MentionInputView.swift's `chipImage` does it: the
 * font's line high (about 1.2 times its size), the avatar filling the height less its inset on each
 * side, the label at the text's size, a pill.
 */
export function mentionChipBox(fontSize: number): MentionChipBox {
  const height = Math.ceil(fontSize * FONT_LINE);
  return {
    height,
    avatar: Math.max(height - mentionChipStyle.avatarInset * 2, 0),
    inset: mentionChipStyle.avatarInset,
    gap: mentionChipStyle.labelGap,
    trailing: mentionChipStyle.trailing,
    labelSize: fontSize,
    radius: height / 2,
  };
}

// The system font's line for its size (UIFont.lineHeight / pointSize).
const FONT_LINE = 1.2;
