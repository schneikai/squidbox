import { StyleSheet, View } from 'react-native';

import promptTurn from './promptTurn';
import useChatSession from './useChatSession';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import Field from '@/components/Field';
import ListDivider from '@/components/ListDivider';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonChip from '@/features/prompt-buttons/PromptButtonChip';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';

/**
 * "Write with AI" under the post editor's caption, for an account with the assistant: without text the
 * new-post prompt buttons and Ask anything, with text Back to chat (Ask anything before there is a
 * chat) and the Refine buttons. Each opens the chat (`sessionId`), a prompt button with its prompt
 * in the composer, ready to send.
 */
export default function WriteWithAi(props) {
  const isAvailable = useIsAssistantAvailable();
  if (!isAvailable) return null;
  return <WriteWithAiSection {...props} />;
}

function WriteWithAiSection({ sessionId, text, navigation }) {
  const groups = usePromptButtons();
  const chat = useChatSession(sessionId);
  useSeedPromptButtons();

  const hasText = Boolean(text.trim());
  const hasMessages = (chat?.messages.length ?? 0) > 0;
  const buttons = (hasText ? groups?.refine : groups?.newPost) ?? [];
  const opener =
    hasText && hasMessages
      ? { label: 'Back to chat', icon: 'message-circle' }
      : { label: 'Ask anything', icon: 'sparkle' };
  const openerChip = <Chip label={opener.label} icon={opener.icon} variant="outlined" onPress={() => openChat()} />;

  function openChat(prompt) {
    navigation.navigate('PostChatScreen', prompt ? { sessionId, prompt } : { sessionId });
  }

  if (!chat) return null;

  return (
    <View style={styles.section}>
      <ListDivider style={styles.divider} />
      <Field label="Write with AI" rightSlot={<EditPromptButtonsButton />}>
        <ChipRow>
          {hasText && openerChip}
          {buttons.map((button) => (
            <PromptButtonChip key={button.id} button={button} onPress={(pressed) => openChat(promptTurn(pressed))} />
          ))}
          {!hasText && openerChip}
        </ChipRow>
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
