import { router } from 'expo-router';

import useChatSession from './useChatSession';

import AssistantTray, { TRAY_INSET } from '@/components/AssistantTray';
import Chip from '@/components/Chip';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';

/**
 * "Write with AI" under a post (a posted post and its thread, the editor's card being edited), for
 * an account with the assistant: an AssistantTray with Ask anything (Back to chat once there is a
 * chat) first, then the prompt buttons, on one line that scrolls sideways and fades out at the
 * tray's edge. Each opens the chat about `sessionId` (inside the sheet it is in, else as a sheet), a
 * prompt button with its prompt in the composer, ready to edit and send. style is for layout only.
 */
export default function WriteWithAi(props) {
  const isAvailable = useIsAssistantAvailable();
  if (!isAvailable) return null;
  return <WriteWithAiSection {...props} />;
}

function WriteWithAiSection({ sessionId, style }) {
  const buttons = usePromptButtons();
  const chat = useChatSession(sessionId);
  useSeedPromptButtons();

  const hasMessages = (chat?.messages.length ?? 0) > 0;
  const opener = hasMessages
    ? { label: 'Back to chat', icon: 'message-circle' }
    : { label: 'Ask anything', icon: 'sparkle' };

  // A prompt button's turn goes as the chat's `label` and `prompt` params.
  function openChat(button) {
    const params = button ? { sessionId, label: button.name, prompt: button.prompt } : { sessionId };
    router.navigate({ pathname: '/chat/[sessionId]', params });
  }

  if (!chat) return null;

  return (
    <AssistantTray title="Write with AI" trailing={<EditPromptButtonsButton colorPalette="accent" />} style={style}>
      <PromptButtonRow
        buttons={buttons ?? []}
        inset={TRAY_INSET}
        onPress={openChat}
        leading={<Chip label={opener.label} icon={opener.icon} variant="lead" onPress={() => openChat()} />}
      />
    </AssistantTray>
  );
}
