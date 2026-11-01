import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import useChatSession from './useChatSession';

import Chip from '@/components/Chip';
import Divider from '@/components/Divider';
import Field from '@/components/Field';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';

/**
 * "Write with AI" under a post's text (the editor's caption, a posted post), for an account with the
 * assistant: the prompt buttons on one line, then Back to chat (Ask anything before there is a chat).
 * Each opens the chat about `sessionId` (inside the sheet it is in, else as a sheet), a prompt button
 * with its prompt in the composer, ready to edit and send. style is for layout only.
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
    <View style={[styles.section, style]}>
      <Divider style={styles.divider} />
      <Field label="Write with AI" trailing={<EditPromptButtonsButton />}>
        <PromptButtonRow buttons={buttons ?? []} onPress={openChat}>
          <Chip label={opener.label} icon={opener.icon} variant="action" onPress={() => openChat()} />
        </PromptButtonRow>
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits under the caption, a divider away from it.
  section: {
    marginTop: 14,
    gap: 14,
  },
  divider: {
    marginLeft: 0,
  },
});
