import ChatBubble from '@/components/ChatBubble';

type AssistantBubbleProps = { text: string };

/** What the assistant says in the chat (`text`): its bubble, with a copy icon under it (a bio or a profile text). */
export default function AssistantBubble({ text }: AssistantBubbleProps) {
  return <ChatBubble side="assistant" text={text} isCopyable />;
}
