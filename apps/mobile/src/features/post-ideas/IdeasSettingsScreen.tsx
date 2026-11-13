import { DEFAULT_IDEA_PROMPTS, IDEA_SETTING_LIMITS, IDEAS_KINDS, type IdeasKind, z } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import ideasText from './ideasText';
import useIdeaSettings from './useIdeaSettings';

import ActionButtons, { type ActionButtonsProps } from '@/components/ActionButtons';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import Switch from '@/components/Switch';
import TextInput from '@/components/TextInput';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useAvailableParam from '@/hooks/useAvailableParam';
import useResetChanges from '@/hooks/useResetChanges';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import { scale, space } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { saveIdeaSettings } from '@/sync/ideaSettingsRepository';
import { requestSync } from '@/sync/worker';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

const kindSchema = z.enum(IDEAS_KINDS);

// Settings → Assistant → Post ideas or Repost ideas (the route's `kind`; an unknown one leaves).
export default function IdeasSettingsScreen() {
  const param = useAvailableParam('kind', kindSchema);
  const settings = useIdeaSettings();

  if (!param || !settings) return null;
  const { value: kind, userId } = param;
  return (
    <IdeasSettingsEditor
      key={kind}
      kind={kind}
      userId={userId}
      isOn={settings[kind].isOn}
      seed={settings[kind].prompt}
    />
  );
}

type IdeasSettingsEditorProps = { kind: IdeasKind; userId: string; isOn: boolean; seed: string };

// The switch, saved as it flips, and the prompt, saved as you type from `seed` on: an emptied prompt
// is the built-in one again, as Reset changes puts it back (offered only while the prompt is another,
// and confirmed first: the screen saves as you type, so there is no draft to close).
function IdeasSettingsEditor({ kind, userId, isOn, seed }: IdeasSettingsEditorProps) {
  const navigation = useNavigation();
  const [prompt, setPrompt] = useState(seed);
  const builtIn = DEFAULT_IDEA_PROMPTS[kind];
  const { name, switchLabel } = ideasText[kind];
  const { isResetting, reset } = useResetChanges();
  const { flush } = useSaveAsYouType(prompt.trim(), (next) =>
    saveIdeaSettings(getDb(), userId, kind, { prompt: next || null }),
  );

  const actions: ActionButtonsProps['actions'] =
    prompt.trim() === builtIn
      ? []
      : [{ label: 'Reset changes', colorPalette: 'danger', onPress: handleReset, loading: isResetting }];

  function handleReset() {
    return reset("Your prompt is replaced by the app's.", async () => setPrompt(builtIn));
  }

  function handleSwitch(next: boolean) {
    saveIdeaSettings(getDb(), userId, kind, { isOn: next }).then(requestSync, (error) => {
      console.error('Saving the ideas switch failed', error);
      Alert.alert("Couldn't save your changes", apiErrorMessage(error));
    });
  }

  return (
    <Page testID="ideas-settings-screen">
      <FloatingDetailHeader title={name} onBack={() => navigation.goBack()} />
      <DetailScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Section>
          <Row label={switchLabel}>
            <Switch value={isOn} onValueChange={handleSwitch} accessibilityLabel={switchLabel} />
          </Row>
        </Section>
        <Field label="Prompt">
          <TextInput
            variant="field"
            multiline
            value={prompt}
            onChangeText={setPrompt}
            onBlur={() => flush()}
            placeholder={builtIn}
            maxLength={IDEA_SETTING_LIMITS.prompt}
            minHeight={scale(132)}
          />
        </Field>
        <ActionButtons actions={actions} isScreenEnd />
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.xl,
  },
});
