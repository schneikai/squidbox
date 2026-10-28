import { PERSONA_LIMITS } from '@squidbox/shared';
import { Alert } from 'react-native';

import ChatBubble from './ChatBubble';

import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { addRule } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';

/**
 * One of the user's turns in the chat: a violet bubble with the prompt button's name (`label`) over
 * what was sent (`content`), and a ⋯ under it to add the text to the rules of Writing as you.
 */
export default function UserMessage({ label, content }) {
  const haptics = useHaptics();
  const { library } = useLibrary();
  const userId = library.owner.userId;

  async function handleAddToRules() {
    try {
      const result = await addRule(getDb(), userId, content);
      if (result === 'tooLong') {
        Alert.alert('Too long for a rule', `A rule can have up to ${PERSONA_LIMITS.rule} characters.`);
        return;
      }
      if (result === 'full') {
        Alert.alert('No room for another rule', `Writing as you has up to ${PERSONA_LIMITS.rules} rules.`);
        return;
      }
      if (result === 'added') requestSync();
      haptics.success();
    } catch (error) {
      console.error('Adding the rule failed', error);
      haptics.error();
      Alert.alert("Couldn't add the rule", error.message);
    }
  }

  return (
    <ChatBubble side="user" label={label} text={content}>
      <MenuOption label="Add to rules" icon="list-checks" onPress={handleAddToRules} />
    </ChatBubble>
  );
}
