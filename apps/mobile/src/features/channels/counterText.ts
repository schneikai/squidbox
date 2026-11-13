import type { Channel } from '@squidbox/shared';

import textLength from './textLength';

/** The counter beside a post's text: "45 / 280"; null without a limit. */
export default function counterText(channel: Pick<Channel, 'maxTextLength'> | undefined, text: string): string | null {
  if (channel?.maxTextLength == null) return null;
  return `${textLength(text)} / ${channel.maxTextLength}`;
}
