import type { NewPromptButton } from '@squidbox/shared';
import { router } from 'expo-router';

import type { ChatParams } from './PostChatScreen';
import useChatSession from './useChatSession';

import AssistantTray, { type AssistantTrayProps } from '@/components/AssistantTray';
import Chip, { type ChipProps } from '@/components/Chip';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';

type WriteWithAiProps = { sessionId: string | null; style?: AssistantTrayProps['style'] };

// The chat route's params, with the id as this tray has it (null only before the chat opens, when
// there is no tray to tap).
type OpenChatParams = Omit<ChatParams, 'sessionId'> & Pick<WriteWithAiProps, 'sessionId'>;

/**
 * "Write with AI" under a post (a posted post and its thread, the editor's card being edited), for
 * an account with the assistant: an AssistantTray with the prompt buttons, then Ask anything (Back to
 * chat once there is a chat) last, on one line that scrolls sideways and fades out at the
 * tray's edge. Each opens the chat about `sessionId` (inside the sheet it is in, else as a sheet), a
 * prompt button with its prompt in the composer, ready to edit and send. style is for layout only.
 */
export default function WriteWithAi(props: WriteWithAiProps) {
  const isAvailable = useIsAssistantAvailable();
  if (!isAvailable) return null;
  return <WriteWithAiSection {...props} />;
}

// The tray itself, once the assistant is available.
function WriteWithAiSection({ sessionId, style }: WriteWithAiProps) {
  const buttons = usePromptButtons();
  const chat = useChatSession(sessionId);
  useSeedPromptButtons();

  const hasMessages = (chat?.messages.length ?? 0) > 0;
  const opener: Pick<ChipProps, 'label' | 'icon'> = hasMessages
    ? { label: 'Back to chat', icon: 'message-circle' }
    : { label: 'Ask anything', icon: 'sparkle' };

  // A prompt button's turn goes as the chat's `label` and `prompt` params.
  function openChat(button?: NewPromptButton) {
    const params: OpenChatParams = button ? { sessionId, label: button.name, prompt: button.prompt } : { sessionId };
    router.navigate({ pathname: '/chat/[sessionId]', params });
  }

  if (!chat) return null;

  return (
    <AssistantTray title="Write with AI" trailing={<EditPromptButtonsButton />} style={style}>
      <PromptButtonRow buttons={buttons ?? []} onPress={openChat}>
        <Chip label={opener.label} icon={opener.icon} variant="lead" onPress={() => openChat()} />
      </PromptButtonRow>
    </AssistantTray>
  );
}
