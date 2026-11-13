import type { Channel } from '@squidbox/shared';

import textLength from './textLength';

/** Whether `text` is longer than the channel allows; never without a limit. A warning, never a block: the post saves as it is. */
export default function isTextOver(channel: Pick<Channel, 'maxTextLength'> | undefined, text: string): boolean {
  return channel?.maxTextLength != null && textLength(text) > channel.maxTextLength;
}
