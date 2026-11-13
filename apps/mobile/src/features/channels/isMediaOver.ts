import type { Channel } from '@squidbox/shared';

/** Whether `count` Assets are more than the channel takes; never without a limit. A warning, never a block. */
export default function isMediaOver(channel: Pick<Channel, 'maxMedia'> | undefined, count: number): boolean {
  return channel?.maxMedia != null && count > channel.maxMedia;
}
