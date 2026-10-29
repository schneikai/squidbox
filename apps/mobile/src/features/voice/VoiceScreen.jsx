import { PERSONA_LIMITS, uniqueTags } from '@squidbox/shared';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import FieldInfoSheet from './FieldInfoSheet';
import voiceFields from './voiceFields';

import CardTextField from '@/components/CardTextField';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import Switch from '@/components/Switch';
import TagsField from '@/components/TagsField';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { EMPTY_PERSONA, readPersona, savePersona } from '@/sync/personaRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { requestSync } from '@/sync/worker';
import changedValues from '@/utils/changedValues';

// The fields this screen edits in place (Rules have their own screen, from Assistant).
const TEXT_FIELDS = ['aboutYou', 'tone', 'contentTags'];

// Settings → Assistant → Writing as you: what the assistant writes with, as plain fields, saved as
// you type, and the Adult content switch under Your content, saved as it flips. Reachable from
// anywhere (a root screen), so the chat opens it too.
export default function VoiceScreen({ navigation }) {
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const seed = useSeedOrClose(async (db) => {
    const persona = (await readPersona(db, userId)) ?? EMPTY_PERSONA;
    return Object.fromEntries(TEXT_FIELDS.map((field) => [field, persona[field]]));
  }, 'persona');
  if (!isAvailable || !seed) return null;
  return <VoiceEditor userId={userId} seed={seed} navigation={navigation} />;
}

function VoiceEditor({ userId, seed, navigation }) {
  const [draft, setDraft] = useState(seed);
  const [info, setInfo] = useState({ field: 'aboutYou', isVisible: false });
  // One setter per field that keeps its identity, so typing in one field leaves the others' lists
  // (memo) alone.
  const [setters] = useState(() =>
    Object.fromEntries(
      TEXT_FIELDS.map((field) => [field, (value) => setDraft((current) => ({ ...current, [field]: value }))]),
    ),
  );
  const persona = useLiveQuery((db) => readPersona(db, userId), [schema.personas], [userId]);
  const { flush } = useSaveAsYouType(normalized(draft), saveFields);

  // Only what the user changed, so a field another device edited meanwhile keeps that edit.
  async function saveFields(next, stored) {
    await savePersona(getDb(), userId, changedValues(stored, next));
  }

  function handleAdultContentChange(isOn) {
    savePersona(getDb(), userId, { adultContent: isOn }).then(requestSync, (error) => {
      console.error('Saving Adult content failed', error);
      Alert.alert("Couldn't save your changes", error.message);
    });
  }

  function showInfo(field) {
    setInfo({ field, isVisible: true });
  }

  function textField(field, maxLength) {
    const { label, placeholder } = voiceFields[field];
    return (
      <Field label={label} onInfo={() => showInfo(field)}>
        <CardTextField
          multiline
          value={draft[field]}
          onChangeText={setters[field]}
          onBlur={() => flush()}
          placeholder={placeholder}
          maxLength={maxLength}
          minHeight={scale(88)}
        />
      </Field>
    );
  }

  return (
    <Page>
      <FloatingDetailHeader title="Writing as you" onBack={() => navigation.goBack()} />
      <DetailScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {textField('aboutYou', PERSONA_LIMITS.aboutYou)}
        {textField('tone', PERSONA_LIMITS.tone)}
        <Field label={voiceFields.contentTags.label} onInfo={() => showInfo('contentTags')}>
          <TagsField
            tags={draft.contentTags}
            onChange={setters.contentTags}
            placeholder={voiceFields.contentTags.placeholder}
            maxTags={PERSONA_LIMITS.contentTags}
            maxTagLength={PERSONA_LIMITS.contentTag}
          />
        </Field>
        <Section>
          <Row label="Adult content">
            <Switch
              value={persona?.adultContent ?? false}
              onValueChange={handleAdultContentChange}
              disabled={persona === undefined}
              accessibilityLabel="Adult content"
            />
          </Row>
        </Section>
      </DetailScrollView>
      <FieldInfoSheet
        field={info.field}
        isVisible={info.isVisible}
        onClose={() => setInfo((current) => ({ ...current, isVisible: false }))}
      />
    </Page>
  );
}

// The fields as they are saved: texts trimmed, a tag once.
function normalized(draft) {
  return {
    aboutYou: draft.aboutYou.trim(),
    tone: draft.tone.trim(),
    contentTags: uniqueTags(draft.contentTags).slice(0, PERSONA_LIMITS.contentTags),
  };
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
  },
});
