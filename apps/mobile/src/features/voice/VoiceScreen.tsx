import { PERSONA_LIMITS, type PersonaFields, uniqueTags } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import FieldInfoSheet, { type FieldInfoSheetProps } from './FieldInfoSheet';
import voiceFields from './voiceFields';

import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import Switch from '@/components/Switch';
import TagsField from '@/components/TagsField';
import TextInput from '@/components/TextInput';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useAvailableUserId from '@/hooks/useAvailableUserId';
import usePersona from '@/hooks/usePersona';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { scale, space } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { EMPTY_PERSONA, readPersona, savePersona } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';
import changedValues from '@/utils/changedValues';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The fields this screen edits in place (Rules have their own screen, from Assistant).
type VoiceDraft = Pick<PersonaFields, 'aboutYou' | 'tone' | 'contentTags'>;

// One setter per field.
type VoiceSetters = { [K in keyof VoiceDraft]: (value: VoiceDraft[K]) => void };

// Settings → Assistant → Writing as you: what the assistant writes with, as plain fields, saved as
// you type, and the Adult content switch under Your content, saved as it flips.
export default function VoiceScreen() {
  const userId = useAvailableUserId();

  if (userId === null) return null;
  return <SeededVoiceEditor userId={userId} />;
}

type SeededVoiceEditorProps = { userId: string };

// The screen once the account is known: the fields as stored, then the editor.
function SeededVoiceEditor({ userId }: SeededVoiceEditorProps) {
  const seed = useSeedOrClose(async (db): Promise<VoiceDraft> => {
    const persona = (await readPersona(db, userId)) ?? EMPTY_PERSONA;
    return { aboutYou: persona.aboutYou, tone: persona.tone, contentTags: persona.contentTags };
  }, 'persona');

  if (!seed) return null;
  return <VoiceEditor userId={userId} seed={seed} />;
}

type VoiceEditorProps = { userId: string; seed: VoiceDraft };

// The fields, saved as you type from `seed` on, and the Adult content switch.
function VoiceEditor({ userId, seed }: VoiceEditorProps) {
  const navigation = useNavigation();
  const [draft, setDraft] = useState<VoiceDraft>(seed);
  const [info, setInfo] = useState<{ field: FieldInfoSheetProps['field']; isVisible: boolean }>({
    field: 'aboutYou',
    isVisible: false,
  });
  // One setter per field that keeps its identity, so typing in one field leaves the others' lists
  // (memo) alone.
  const [setters] = useState<VoiceSetters>(() => ({
    aboutYou: setterOf('aboutYou'),
    tone: setterOf('tone'),
    contentTags: setterOf('contentTags'),
  }));
  const persona = usePersona();
  const { flush } = useSaveAsYouType(normalized(draft), saveFields);

  function setterOf<K extends keyof VoiceDraft>(field: K) {
    return (value: VoiceDraft[K]) => setDraft((current) => ({ ...current, [field]: value }));
  }

  // Only what the user changed, so a field another device edited meanwhile keeps that edit.
  async function saveFields(next: VoiceDraft, stored: VoiceDraft) {
    await savePersona(getDb(), userId, changedValues(stored, next));
  }

  function handleAdultContentChange(isOn: boolean) {
    savePersona(getDb(), userId, { adultContent: isOn }).then(requestSync, (error) => {
      console.error('Saving Adult content failed', error);
      Alert.alert("Couldn't save your changes", apiErrorMessage(error));
    });
  }

  function showInfo(field: FieldInfoSheetProps['field']) {
    setInfo({ field, isVisible: true });
  }

  function textField(field: Exclude<keyof VoiceDraft, 'contentTags'>, maxLength: number) {
    const { label, placeholder } = voiceFields[field];
    return (
      <Field label={label} onInfo={() => showInfo(field)}>
        <TextInput
          variant="field"
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
        {/* one block, so the content's gap doesn't part the footnote from its switch */}
        <View>
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
          <SectionFooter>Adult content gets an uncensored assistant.</SectionFooter>
        </View>
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
function normalized(draft: VoiceDraft): VoiceDraft {
  return {
    aboutYou: draft.aboutYou.trim(),
    tone: draft.tone.trim(),
    contentTags: uniqueTags(draft.contentTags).slice(0, PERSONA_LIMITS.contentTags),
  };
}

const styles = StyleSheet.create({
  content: {
    gap: space.xl,
  },
});
