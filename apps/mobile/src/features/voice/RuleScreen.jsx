import { PERSONA_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import voiceFields from './voiceFields';

import TextEditSheet from '@/components/TextEditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import ruleResultText from '@/lib/ruleResultText';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { addRule, readPersona, removeRule, updateRule } from '@/sync/personaRepository';

// One of the Rules, as a draft sheet: `{ index }` edits that rule (Save, or Delete), no
// params adds one (Add).
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
  const [text, setText] = useState(seed.text);
  // The text Add or Save refused and why: shown while the text is still that one.
  const [rejected, setRejected] = useState(null);
  const isNew = index == null;
  const { sheetProps, finish } = useEditSheet({
    isNew,
    isValid: Boolean(text.trim()),
    isDirty: text.trim() !== seed.text,
    save,
  });

  const notice = rejected?.text === text ? rejected.message : null;

  // A rule changed or removed on another device meanwhile isn't saved over: the sheet says so and
  // closes.
  async function save() {
    const db = getDb();
    const result = isNew
      ? await addRule(db, userId, text)
      : await updateRule(db, userId, { index, text: seed.text }, text);
    if (result === 'gone') {
      return () => {
        Alert.alert('This rule was changed on another device.');
        navigation.goBack();
      };
    }
    if (result !== 'added' && result !== 'updated') {
      setRejected({ text, message: ruleResultText[result] });
      return false;
    }
  }

  function handleDelete() {
    finish(() => removeRule(getDb(), userId, { index, text: seed.text }), "Couldn't delete the rule");
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Rule"
      value={text}
      onChangeText={setText}
      placeholder={voiceFields.rules.placeholder}
      maxLength={PERSONA_LIMITS.rule}
      autoFocus={isNew}
      description={notice ?? voiceFields.rules.description}
      actions={isNew ? [] : [{ label: 'Delete rule', colorPalette: 'danger', onPress: handleDelete }]}
    />
  );
}
