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
import { getDb } from '@/sync/db/client';
import { readPersona, savePersona } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';

// One of the Rules, saved as you type: `{ index }` edits that rule (or Delete), no params
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
  // Where the rule was last seen and its stored text, to find it again after a sync moved or
  // changed the list (null: a new rule not stored yet), and whether it was gone when last looked for.
  const ruleRef = useRef(index == null ? null : { index, text: seed.text });
  const isGoneRef = useRef(false);
  const { flush, end } = useSaveAsYouType(text.trim(), saveText);

  // The rule's place in `rules` now: where it was if its text is still there, else the first rule
  // with its text; -1 when it's gone, null for a rule not stored yet.
  function locate(rules) {
    const rule = ruleRef.current;
    if (!rule) return null;
    return rules[rule.index] === rule.text ? rule.index : rules.indexOf(rule.text);
  }

  async function readRules(db) {
    return (await readPersona(db, userId))?.rules ?? [];
  }

  // A sync removed or changed the rule meanwhile: nothing is saved over another rule, and the screen
  // closes.
  function handleGone(isLeaving) {
    isGoneRef.current = true;
    if (isLeaving) return;
    Alert.alert('This rule was changed on another device.');
    navigation.goBack();
  }

  async function saveText(next, stored, { isLeaving }) {
    if (isGoneRef.current || (!next && !isLeaving)) return false;
    const db = getDb();
    const rules = await readRules(db);
    const at = locate(rules);
    if (at === -1) {
      handleGone(isLeaving);
      return false;
    }
    if (!next) {
      // Empty: dropped when you leave.
      if (at != null) await savePersona(db, userId, { rules: rules.filter((_, i) => i !== at) });
      return false;
    }
    const nextAt = at ?? rules.length;
    await savePersona(db, userId, {
      rules: at == null ? [...rules, next] : rules.map((rule, i) => (i === at ? next : rule)),
    });
    ruleRef.current = { index: nextAt, text: next };
    return true;
  }

  // After the saves under way, and nothing typed is saved after it.
  async function handleDelete() {
    try {
      await end(async () => {
        const db = getDb();
        const rules = await readRules(db);
        const at = locate(rules);
        if (at != null && at !== -1) await savePersona(db, userId, { rules: rules.filter((_, i) => i !== at) });
      });
      requestSync();
      navigation.goBack();
    } catch (error) {
      console.error('Deleting the rule failed', error);
      haptics.error();
      Alert.alert("Couldn't delete the rule", error.message);
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
      autoFocus={index == null}
      description={voiceFields.rules.description}
      action={index != null ? { label: 'Delete rule', tone: 'danger', onPress: handleDelete } : null}
    />
  );
}
