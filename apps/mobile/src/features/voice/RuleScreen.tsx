import { PERSONA_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import voiceFields from './voiceFields';

import TextEditSheet from '@/components/TextEditSheet';
import useAvailableUserId from '@/hooks/useAvailableUserId';
import useEditSheet from '@/hooks/useEditSheet';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import ruleResultText from '@/lib/ruleResultText';
import { getDb } from '@/sync/db/client';
import { addRule, readPersona, removeRule, type SeededRule, updateRule } from '@/sync/personaRepository';

// One of the Rules, as a draft sheet: `rules/[index]` edits that rule (Save, or Delete), `rules/new`
// adds one (Add).
export default function RuleScreen() {
  // `rules/[index]` gives the index, `rules/new` doesn't.
  const params = useLocalSearchParams<{ index?: string }>();
  const index = params.index === undefined ? undefined : Number(params.index);
  const userId = useAvailableUserId();

  if (userId === null) return null;
  return <SeededRuleEditor userId={userId} index={index} />;
}

type SeededRuleEditorProps = { userId: string; index: number | undefined };

// The sheet once the account is known: the rule as stored (none for a new one), then the editor. A
// rule that isn't there (deleted meanwhile, a bad index) closes it.
function SeededRuleEditor({ userId, index }: SeededRuleEditorProps) {
  const seed = useSeedOrClose(
    async (db): Promise<RuleSeed | null> => {
      if (index === undefined) return { rule: null };
      const text = (await readPersona(db, userId))?.rules[index];
      return text == null ? null : { rule: { index, text } };
    },
    `${userId}:${index ?? 'new'}`,
    'This rule was deleted.',
  );

  if (!seed) return null;
  return <RuleEditor userId={userId} rule={seed.rule} />;
}

// The rule the sheet edits; null for a new one.
type RuleSeed = { rule: SeededRule | null };

type RuleEditorProps = { userId: string; rule: SeededRule | null };

// The draft of the rule: Add for a new one, Save or Delete rule for a stored one.
function RuleEditor({ userId, rule }: RuleEditorProps) {
  const navigation = useNavigation();
  const storedText = rule?.text ?? '';
  const [text, setText] = useState(storedText);
  const isNew = rule === null;
  const { sheetProps, notice, finish } = useEditSheet({
    isNew,
    isValid: Boolean(text.trim()),
    isDirty: text.trim() !== storedText,
    save,
    text,
  });

  // A rule changed or removed on another device meanwhile isn't saved over: the sheet says so and
  // closes.
  async function save() {
    const db = getDb();
    const result = rule === null ? await addRule(db, userId, text) : await updateRule(db, userId, rule, text);
    if (result === 'gone') {
      return () => {
        Alert.alert('This rule was changed on another device.');
        navigation.goBack();
      };
    }
    if (result !== 'added' && result !== 'updated') return { refused: ruleResultText[result] };
  }

  function handleDelete(seeded: SeededRule) {
    finish(() => removeRule(getDb(), userId, seeded), "Couldn't delete the rule");
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
      actions={
        rule === null ? [] : [{ label: 'Delete rule', colorPalette: 'danger', onPress: () => handleDelete(rule) }]
      }
    />
  );
}
