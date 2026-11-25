import type { Channel } from '@squidbox/shared';

import postsSentTo from './postsSentTo';

import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import type { MentionTextValue } from '@/features/post-mentions/mentionParts';
import textForChannel from '@/features/post-mentions/textForChannel';

/**
 * What a copy sends to its channel, the one shape a posting API will take: each post of the thread
 * in order, its caption as the channel gets it and its assets.
 */
export type ChannelPayload = { channelId: string; posts: { caption: string; assetIds: string[] }[] };

/** A post as a copy holds it: its text and mentions, and its assets' ids. */
export type PayloadPost = MentionTextValue & { assetIds: readonly string[] };

/**
 * The payload of a copy's `posts` for `channel`: the posts that go out there (postsSentTo: only the
 * first on a channel without threads), each caption is textForChannel's, and `missing` the contacts mentioned without a handle there (whose
 * names go out as plain text), once each, in the order they come.
 */
export default function channelPayload(
  channel: Pick<Channel, 'id' | 'handleField' | 'hasThreads'>,
  posts: readonly PayloadPost[],
  contactsById: ReadonlyMap<string, MentionContact>,
): { payload: ChannelPayload; missing: MentionContact[] } {
  const missing = new Map<string, MentionContact>();
  const payloadPosts = postsSentTo(channel, posts).map((post) => {
    const sent = textForChannel(post, contactsById, channel);
    for (const contact of sent.missing) missing.set(contact.id, contact);
    return { caption: sent.text, assetIds: [...post.assetIds] };
  });
  return { payload: { channelId: channel.id, posts: payloadPosts }, missing: [...missing.values()] };
}

/** The payload as one text, what Send now puts on the clipboard: its captions joined by a blank line. */
export function payloadText(payload: ChannelPayload): string {
  return payload.posts
    .map(({ caption }) => caption.trim())
    .filter(Boolean)
    .join('\n\n');
}
