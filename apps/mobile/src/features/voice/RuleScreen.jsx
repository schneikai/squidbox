import { PERSONA_LIMITS } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import voiceFields from './voiceFields';

import TextEditScreen from '@/components/TextEditScreen';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readPersona, savePersona } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';

// One rule of Writing as you, saved as you type: `{ index }` edits that rule (or Delete), no params
// adds one, appended once it has text. A rule left empty is dropped when you leave.
export default function RuleScreen({ route, navigation }) {
  const index = route.params?.index;
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const seed = useSeedOrClose(
    async (db) => {
      if (index == null) return { text: '' };
      const text = (await readPersona(db, userId))?.rules[index];
      return text == null ? null : { text };
    },
    `${userId}:${index ?? 'new'}`,
    'This rule was deleted.',
  );
  if (!isAvailable || !seed) return null;
  return <RuleEditor index={index} userId={userId} seed={seed} navigation={navigation} />;
}

function RuleEditor({ index, userId, seed, navigation }) {
  const haptics = useHaptics();
  const [text, setText] = useState(seed.text);
  // The rule's place in the list once it has one (a new rule gets it with its first text), and
  // whether Delete removed it, after which nothing is saved.
  const indexRef = useRef(index ?? null);
  const isRemovedRef = useRef(false);
  const flush = useSaveAsYouType(text.trim(), saveText);

  // The rules as stored now, with `change` applied to them, saved.
  async function changeRules(change) {
    const db = getDb();
    const rules = (await readPersona(db, userId))?.rules ?? [];
    await savePersona(db, userId, { rules: change(rules) });
    requestSync();
  }

  async function saveText(next, previous, { isLeaving }) {
    if (isRemovedRef.current) return true;
    const at = indexRef.current;
    if (!next) {
      // Empty: kept until you leave, then dropped.
      if (isLeaving && at != null) await changeRules((rules) => rules.filter((_, i) => i !== at));
      return false;
    }
    if (at != null) {
      await changeRules((rules) => rules.map((rule, i) => (i === at ? next : rule)));
      return true;
    }
    await changeRules((rules) => {
      indexRef.current = rules.length;
      return [...rules, next];
    });
    return true;
  }

  async function handleDelete() {
    if (isRemovedRef.current) return;
    isRemovedRef.current = true;
    const at = indexRef.current;
    try {
      if (at != null) await changeRules((rules) => rules.filter((_, i) => i !== at));
      navigation.goBack();
    } catch (error) {
      console.error('Deleting the rule failed', error);
      haptics.error();
      Alert.alert("Couldn't delete the rule", error.message);
      isRemovedRef.current = false;
    }
  }

  return (
    <TextEditScreen
      title="Rule"
      value={text}
      onChangeText={setText}
      onBlur={() => flush()}
      onBack={() => navigation.goBack()}
      placeholder={voiceFields.rules.placeholder}
      maxLength={PERSONA_LIMITS.rule}
      minHeight={scale(88)}
      autoFocus={index == null}
      description={voiceFields.rules.description}
      action={index != null ? { label: 'Delete rule', tone: 'danger', onPress: handleDelete } : null}
    />
  );
}
