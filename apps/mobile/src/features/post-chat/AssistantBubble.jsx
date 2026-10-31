import ChatBubble from '@/components/ChatBubble';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useCopyText from '@/hooks/useCopyText';

/**
 * What the assistant says in the chat (`text`): its bubble, with Copy in the ⋯ (a bio or a profile
 * text).
 */
export default function AssistantBubble({ text }) {
  const copy = useCopyText();

  return (
    <ChatBubble side="assistant" text={text}>
      <MenuOption label="Copy" icon="copy" onPress={() => copy(text)} />
    </ChatBubble>
  );
}
