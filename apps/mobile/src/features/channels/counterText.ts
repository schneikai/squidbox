import type { Channel } from '@squidbox/shared';

import textLength from './textLength';

// The share of the limit the text reaches before the counter shows (X starts its warning at 260 of 280).
const NEAR_LIMIT = 0.9;

/**
 * The counter beside a post's text: "260 / 280"; null without a limit, and while the text is still well
 * short of it (under NEAR_LIMIT of it), as it says nothing worth reading then.
 */
export default function counterText(channel: Pick<Channel, 'maxTextLength'> | undefined, text: string): string | null {
  if (channel?.maxTextLength == null) return null;
  const length = textLength(text);
  if (length < channel.maxTextLength * NEAR_LIMIT) return null;
  return `${length} / ${channel.maxTextLength}`;
}
