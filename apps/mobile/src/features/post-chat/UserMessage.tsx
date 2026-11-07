import { Alert } from 'react-native';

import type { UserChatMessage } from './chatSessions';

import ChatBubble from '@/components/ChatBubble';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import ruleResultText from '@/lib/ruleResultText';
import { getDb } from '@/sync/db/client';
import { addRule } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';

type UserMessageProps = Pick<UserChatMessage, 'label' | 'content'> & { userId: string };

/**
 * One of the user's turns in the chat: a violet bubble with the prompt button's name (`label`) over
 * what was sent (`content`), and a ⋯ under it to add the text to the Rules.
 */
export default function UserMessage({ label, content, userId }: UserMessageProps) {
  const haptics = useHaptics();

  async function handleAddToRules() {
    try {
      const result = await addRule(getDb(), userId, content);
      if (result === 'tooLong') {
        Alert.alert('Too long for a rule', ruleResultText.tooLong);
        return;
      }
      if (result === 'full') {
        Alert.alert('No room for another rule', ruleResultText.full);
        return;
      }
      if (result === 'added') requestSync();
      haptics.success();
    } catch (error) {
      console.error('Adding the rule failed', error);
      haptics.error();
      Alert.alert("Couldn't add the rule", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <ChatBubble side="user" label={label} text={content}>
      <MenuOption label="Add to rules" icon="list-checks" onPress={handleAddToRules} />
    </ChatBubble>
  );
}
