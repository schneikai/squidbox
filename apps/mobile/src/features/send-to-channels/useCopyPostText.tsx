import { CHANNELS, type Channel } from '@squidbox/shared';
import { useState } from 'react';

import CopyTextSheet, { type ChannelChoice } from './CopyTextSheet';
import channelPayload, { payloadText } from './channelPayload';

import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import mentionLabel from '@/features/post-mentions/mentionLabel';
import mentionParts, { type MentionTextValue } from '@/features/post-mentions/mentionParts';
import readMentionContacts from '@/features/post-mentions/readMentionContacts';
import useCopyText from '@/hooks/useCopyText';
import { getDb } from '@/sync/db/client';
import readPost from '@/sync/queries/readPost';

/**
 * Copy text in a post's menu: `copyPostText(postId)` reads the post with its thread and the contacts
 * it mentions at the tap, and copies the text as a channel gets it (channelPayload, its thread's
 * posts joined by a blank line). Where the channels' texts differ (a mention with a handle on one
 * and not another), it asks once which channel (`sheet`, CopyTextSheet, mounted only while it asks);
 * where they are all the same, it copies at once.
 */
export default function useCopyPostText() {
  const copyText = useCopyText();
  const [choices, setChoices] = useState<ChannelChoice[] | null>(null);

  async function copyPostText(postId: string) {
    const db = getDb();
    const post = await readPost(db, postId);
    if (!post) return;
    const parts = [post, ...post.threadPosts];
    const contactsById = await readMentionContacts(db, parts);
    const posts = parts.map(({ text, mentions, postAssets }) => ({
      text,
      mentions,
      assetIds: postAssets.map(({ asset }) => asset.id),
    }));
    // A channel per handle: OnlyFans PPV goes out as OnlyFans does.
    const channels = CHANNELS.filter(
      (channel, i) => CHANNELS.findIndex(({ handleField }) => handleField === channel.handleField) === i,
    );
    const texts = channels.map((channel) => ({
      channel,
      text: payloadText(channelPayload(channel, posts, contactsById).payload),
      mentions: mentionsText(parts, contactsById, channel),
    }));
    if (new Set(texts.map(({ text }) => text)).size <= 1) await copyText(texts[0]?.text ?? '');
    else setChoices(texts);
  }

  const sheet = choices && (
    <CopyTextSheet
      choices={choices}
      onPick={async (choice) => {
        setChoices(null);
        await copyText(choice.text);
      }}
      onClose={() => setChoices(null)}
    />
  );

  return { copyPostText, sheet };
}

// The post's mentions as they read on `channel`, each once, in order ("@maya.bsky.social, Sam Ridge").
function mentionsText(
  parts: readonly MentionTextValue[],
  contactsById: ReadonlyMap<string, MentionContact>,
  channel: Channel,
): string {
  const labels = parts.flatMap(({ text, mentions }) =>
    mentionParts(text, mentions).flatMap((part) =>
      part.kind === 'mention' ? [mentionLabel(part.mention, contactsById, channel)] : [],
    ),
  );
  return [...new Set(labels)].join(', ');
}
