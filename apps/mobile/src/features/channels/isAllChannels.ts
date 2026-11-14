/** Whether a version's `channelIds` hold every one of the user's channels (`userChannelIds`), two or more. */
export default function isAllChannels(channelIds: readonly string[], userChannelIds: readonly string[]): boolean {
  return userChannelIds.length > 1 && userChannelIds.every((id) => channelIds.includes(id));
}
