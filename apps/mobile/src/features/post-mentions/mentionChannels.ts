import { CHANNELS, type Channel } from '@squidbox/shared';

/**
 * The channels a post's mentions are shown and copied for (Copy text's sheet, a mention's sheet):
 * the user's channels in their order (the whole catalog while they have none), one per handle,
 * since channels that share a handle get the same text. The one first in the catalog stands for
 * those that share it: OnlyFans for OnlyFans and OnlyFans PPV.
 */
export default function mentionChannels(channels: readonly Channel[]): Channel[] {
  const listed = channels.length > 0 ? channels : CHANNELS;
  const handleFields = [...new Set(listed.map(({ handleField }) => handleField))];
  return handleFields.flatMap(
    (handleField) => CHANNELS.find((each) => each.handleField === handleField && listed.includes(each)) ?? [],
  );
}
