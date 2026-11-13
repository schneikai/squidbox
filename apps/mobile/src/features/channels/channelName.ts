import { channelById } from '@squidbox/shared';

/** A channel's name as the app shows it: the catalog's, the id of one this build doesn't know, or No channel. */
export default function channelName(channelId: string | null): string {
  if (!channelId) return 'No channel';
  return channelById(channelId)?.name ?? channelId;
}
