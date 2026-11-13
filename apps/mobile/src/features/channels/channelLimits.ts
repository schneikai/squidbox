import type { Channel } from '@squidbox/shared';

// What a channel's limits say about a post: the editor's counter and its warnings. Over a limit is a
// warning, never a block (the post saves as it is).

/** A text's length as the counter counts it: code points, so a character outside the BMP counts once. */
export function textLength(text: string): number {
  return [...text].length;
}

/** Whether `text` is longer than the channel allows; never without a limit. */
export function isTextOver(channel: Pick<Channel, 'maxTextLength'> | undefined, text: string): boolean {
  return channel?.maxTextLength != null && textLength(text) > channel.maxTextLength;
}

/** Whether `count` media are more than the channel takes; never without a limit. */
export function isMediaOver(channel: Pick<Channel, 'maxMedia'> | undefined, count: number): boolean {
  return channel?.maxMedia != null && count > channel.maxMedia;
}

/** The counter beside a post's text: "45 / 280"; null without a limit. */
export function counterText(channel: Pick<Channel, 'maxTextLength'> | undefined, text: string): string | null {
  if (channel?.maxTextLength == null) return null;
  return `${textLength(text)} / ${channel.maxTextLength}`;
}
