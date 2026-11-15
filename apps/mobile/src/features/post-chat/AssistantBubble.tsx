import ChatBubble from '@/components/ChatBubble';
import CopyPostTextButton from '@/features/post-mentions/CopyPostTextButton';
import MentionRuns from '@/features/post-mentions/MentionRuns';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import type { MentionTextValue } from '@/features/post-mentions/mentionParts';

type AssistantBubbleProps = {
  value: MentionTextValue;
  contactsById: ReadonlyMap<string, MentionContact>;
};

/**
 * What the assistant says in the chat (`value`, its text with its mentions as chips): its bubble, with
 * a copy icon under it (a bio or a profile text; a chip is copied as the contact's handle,
 * CopyPostTextButton).
 */
export default function AssistantBubble({ value, contactsById }: AssistantBubbleProps) {
  return (
    <ChatBubble
      side="assistant"
      text={<MentionRuns value={value} contactsById={contactsById} />}
      copy={<CopyPostTextButton post={value} />}
    />
  );
}
