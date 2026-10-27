import { StyleSheet, View } from 'react-native';

import useChatSession from './useChatSession';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import Field from '@/components/Field';
import IconButton from '@/components/IconButton';
import ListDivider from '@/components/ListDivider';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';
import { colors, sizes } from '@/styles/designTokens';

/**
 * "Write with AI" under the post editor's caption, for an account with the assistant: without text the
 * new-post prompt buttons and Ask anything, with text Back to chat (Ask anything before there is a
 * chat) and the Refine buttons. Each opens the chat (`sessionId`), a prompt button with its prompt
 * in the composer, ready to send.
 */
export default function WriteWithAi({ sessionId, text, navigation }) {
  const isAvailable = useIsAssistantAvailable();
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

  function openChat(prompt) {
    navigation.navigate('PostChatScreen', prompt ? { sessionId, prompt } : { sessionId });
  }

  if (!isAvailable || !chat) return null;

  const openerChip = (
    <Chip key="open" label={opener.label} icon={opener.icon} variant="outlined" onPress={() => openChat()} />
  );
  const buttonChips = buttons.map((button) => (
    <Chip
      key={button.id}
      label={button.name}
      icon={button.icon}
      variant="outlined"
      onPress={() => openChat({ label: button.name, content: button.prompt })}
    />
  ));

  return (
    <View style={styles.section}>
      <ListDivider style={styles.divider} />
      <Field
        label="Write with AI"
        rightSlot={
          <IconButton
            icon="pencil"
            size={sizes.iconSmall}
            color={colors.text.secondary}
            onPress={() => navigation.navigate('PromptButtonsScreen')}
            accessibilityLabel="Edit prompt buttons"
          />
        }
      >
        <ChipRow>{hasText ? [openerChip, ...buttonChips] : [...buttonChips, openerChip]}</ChipRow>
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
