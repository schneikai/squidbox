import { PERSONA_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import addRuleText from './addRuleText';
import locateRule from './locateRule';
import voiceFields from './voiceFields';

import TextEditSheet from '@/components/TextEditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { addRule, readPersona, savePersona } from '@/sync/personaRepository';

// One rule of Writing as you, as a draft sheet: `{ index }` edits that rule (Done, or Delete), no
// params adds one (Add).
export default function RuleScreen({ route }) {
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
  return <RuleEditor index={index} userId={userId} seed={seed} />;
}

function RuleEditor({ index, userId, seed }) {
  const [text, setText] = useState(seed.text);
  // Why Add didn't add the rule, until the text changes.
  const [notice, setNotice] = useState(null);
  const isNew = index == null;
  const { sheetProps, finish, leave } = useEditSheet({
    isNew,
    isValid: Boolean(text.trim()),
    isDirty: text.trim() !== seed.text,
    save,
  });

  async function readRules(db) {
    return (await readPersona(db, userId))?.rules ?? [];
  }

  // A stored rule is found again by its seeded text, so a sync that moved or changed the list
  // meanwhile never gets another rule overwritten: a rule gone meanwhile closes the sheet.
  async function save() {
    const db = getDb();
    if (isNew) {
      const result = await addRule(db, userId, text);
      if (result === 'added') return true;
      setNotice(addRuleText[result]);
      return false;
    }
    const rules = await readRules(db);
    const at = locateRule(rules, { index, text: seed.text });
    if (at === -1) {
      Alert.alert('This rule was changed on another device.');
      leave();
      return false;
    }
    // Like Add: no rule twice.
    if (rules.some((rule, i) => i !== at && rule === text.trim())) {
      setNotice(addRuleText.present);
      return false;
    }
    await savePersona(db, userId, { rules: rules.map((rule, i) => (i === at ? text.trim() : rule)) });
    return true;
  }

  function handleDelete() {
    finish(async () => {
      const db = getDb();
      const rules = await readRules(db);
      const at = locateRule(rules, { index, text: seed.text });
      // -1: gone already.
      if (at !== -1) await savePersona(db, userId, { rules: rules.filter((_, i) => i !== at) });
    }, "Couldn't delete the rule");
  }

  function handleChangeText(next) {
    setText(next);
    setNotice(null);
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Rule"
      value={text}
      onChangeText={handleChangeText}
      placeholder={voiceFields.rules.placeholder}
      maxLength={PERSONA_LIMITS.rule}
      minHeight={scale(88)}
      autoFocus={isNew}
      description={notice ?? voiceFields.rules.description}
      actions={isNew ? null : [{ label: 'Delete rule', tone: 'danger', onPress: handleDelete }]}
    />
  );
}
