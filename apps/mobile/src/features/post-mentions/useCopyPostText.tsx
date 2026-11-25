import { channelById, type Channel } from '@squidbox/shared';
import { useState } from 'react';

import CopyTextSheet, { type ChannelChoice } from './CopyTextSheet';
import mentionChannels from './mentionChannels';
import type { MentionContact } from './mentionHandle';
import mentionLabel from './mentionLabel';
import type { MentionTextValue } from './mentionParts';
import readMentionContacts from './readMentionContacts';
import textForChannel from './textForChannel';
import validMentions from './validMentions';

import useCopyText from '@/hooks/useCopyText';
import { readChannels } from '@/sync/channelsRepository';
import { getDb } from '@/sync/db/client';

type CopyChannel = Pick<Channel, 'handleField'>;

// The sheet's question and what answers the copy that asked it.
type Question = { choices: ChannelChoice[]; answer: (isCopied: boolean) => void };

/**
 * Copying a post's text, the one way the app does it (CopyPostTextButton, a post card's or an idea's
 * copy icon): `copyPostText(post, channel?)` copies `post`'s text as a channel gets it
 * (textForChannel), each mention as the contact's handle there. For `channel` (a channel copy's) it
 * copies at once; without one it asks which of the user's channels (mentionChannels; `sheet`,
 * CopyTextSheet, mounted only while it asks) whenever their texts differ, which is whenever a
 * mentioned contact has a handle on one of them. Resolves to whether a text was copied.
 */
export default function useCopyPostText() {
  const copyText = useCopyText();
  const [question, setQuestion] = useState<Question | null>(null);

  async function copyPostText(post: MentionTextValue, channel?: CopyChannel) {
    const db = getDb();
    const contactsById = await readMentionContacts(db, [post]);
    const textFor = (each: CopyChannel) => textForChannel(post, contactsById, each);
    if (channel) return copyText(textFor(channel).text.trim());
    const channels = (await readChannels(db)).flatMap((row) => channelById(row.channelId) ?? []);
    const choices = mentionChannels(channels).map((each) => {
      const { text, missing } = textFor(each);
      return {
        channel: each,
        text: text.trim(),
        mentions: mentionsText(post, contactsById, each),
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

// The post's mentions as they are copied for `channel`, each once, in order ("@maya.bsky.social, Sam Ridge").
function mentionsText(
  post: MentionTextValue,
  contactsById: ReadonlyMap<string, MentionContact>,
  channel: Channel,
): string {
  return [...new Set(validMentions(post).map((mention) => mentionLabel(mention, contactsById, channel)))].join(', ');
}
