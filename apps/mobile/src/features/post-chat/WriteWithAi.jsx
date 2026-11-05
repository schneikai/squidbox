import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import AssistantTray, { TRAY_INSET } from './AssistantTray';
import useChatSession from './useChatSession';

import Chip from '@/components/Chip';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';
import { colors, scale } from '@/styles/designTokens';

const FADE = [colors.background.assistantClear, colors.background.assistant];
const FADE_START = { x: 0, y: 0 };
const FADE_END = { x: 1, y: 0 };

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
    <AssistantTray title="Write with AI" trailing={<EditPromptButtonsButton />} style={style}>
      <View style={styles.line}>
        <PromptButtonRow
          buttons={buttons ?? []}
          chipVariant="raised"
          onPress={openChat}
          leading={<Chip label={opener.label} icon={opener.icon} variant="lead" onPress={() => openChat()} />}
          contentContainerStyle={styles.lineContent}
        />
        <LinearGradient colors={FADE} start={FADE_START} end={FADE_END} style={styles.fade} pointerEvents="none" />
      </View>
    </AssistantTray>
  );
}

const styles = StyleSheet.create({
  // Out to the tray's edges, so the chips scroll under its rim; room above and below for their shadow.
  line: {
    marginHorizontal: -TRAY_INSET,
    marginVertical: -scale(4),
  },
  lineContent: {
    paddingHorizontal: TRAY_INSET,
    paddingVertical: scale(4),
  },
  fade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: scale(32),
  },
});
