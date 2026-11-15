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

type CopyChannel = Pick<Channel, 'id' | 'handleField'>;

// The sheet's question and what answers the copy that asked it.
type Question = { choices: ChannelChoice[]; answer: (isCopied: boolean) => void };

/**
 * Copying a post's text, the one way the app does it (a card's copy icon, Copy text in a post's
 * menu): `copyPostText(posts, channel?)` copies the texts of `posts` (a post, or a post and its
 * thread, joined by a blank line) as a channel gets them, each mention as the contact's handle
 * there. For `channel` (a channel copy's) it copies at once; without one it asks which channel
 * (`sheet`, CopyTextSheet, mounted only while it asks) whenever the channels' texts differ, which is
 * whenever a mentioned contact has a handle somewhere. Resolves to whether a text was copied.
 */
export default function useCopyPostText() {
  const copyText = useCopyText();
  const [question, setQuestion] = useState<Question | null>(null);

  async function copyPostText(posts: readonly MentionTextValue[], channel?: CopyChannel) {
    const contactsById = await readMentionContacts(getDb(), posts);
    const payloadPosts = posts.map(({ text, mentions }) => ({ text, mentions, assetIds: [] }));
    const payloadFor = (each: CopyChannel) => channelPayload(each, payloadPosts, contactsById);
    if (channel) return copyText(payloadText(payloadFor(channel).payload));
    // A channel per handle: OnlyFans PPV goes out as OnlyFans does.
    const choices = CHANNELS.filter(
      (each, i) => CHANNELS.findIndex(({ handleField }) => handleField === each.handleField) === i,
    ).map((each) => {
      const { payload, missing } = payloadFor(each);
      return {
        channel: each,
        text: payloadText(payload),
        mentions: mentionsText(posts, contactsById, each),
        hasNoHandle: missing.length > 0,
      };
    });
    if (new Set(choices.map(({ text }) => text)).size <= 1) return copyText(choices[0]?.text ?? '');
    return new Promise<boolean>((answer) => setQuestion({ choices, answer }));
  }

  function close(isCopied: boolean) {
    question?.answer(isCopied);
    setQuestion(null);
  }

  const sheet = question && (
    <CopyTextSheet
      choices={question.choices}
      onPick={async (choice) => close(await copyText(choice.text))}
      onClose={() => close(false)}
    />
  );

  return { copyPostText, sheet };
}

// The posts' mentions as they are copied for `channel`, each once, in order ("@maya.bsky.social, Sam Ridge").
function mentionsText(
  posts: readonly MentionTextValue[],
  contactsById: ReadonlyMap<string, MentionContact>,
  channel: Channel,
): string {
  const labels = posts.flatMap(({ text, mentions }) =>
    mentionParts(text, mentions).flatMap((part) =>
      part.kind === 'mention' ? [mentionLabel(part.mention, contactsById, channel)] : [],
    ),
  );
  return [...new Set(labels)].join(', ');
}
