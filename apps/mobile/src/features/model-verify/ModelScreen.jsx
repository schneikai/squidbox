import { useNavigation } from '@react-navigation/native';
import { Alert, StyleSheet } from 'react-native';

import ModelLabelsSection from './ModelLabelsSection';
import VerifySection from './VerifySection';
import useModelVerification from './useModelVerification';

import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import Switch from '@/components/Switch';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import modelKindText from '@/features/model-compare/modelKindText';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useYourModels from '@/hooks/useYourModels';
import { layout } from '@/styles/designTokens';
import { removeYourModel, resetScores } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import modelDetailText from '@/utils/ai/modelDetailText';
import confirmAsync from '@/utils/confirmAsync';

/**
 * A model of your list (route params `kind`, `modelId`, `name`; an ai_admin tool): its grey line,
 * whether this account writes (or tags) with it, the labels every account sees, its Verify, and
 * Reset score and Remove. A model Venice no longer offers keeps its page, to read its Verify and
 * remove it.
 */
export default function ModelScreen({ route }) {
  const { kind, modelId, name } = route.params;
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const haptics = useHaptics();
  const { error, retry, rows, chosenId, hasChoice, choose } = useYourModels(kind);

  const row = rows?.find((each) => each.id === modelId);
  // The catalog's model, null once Venice no longer offers it.
  const model = row?.model ?? null;
  const { defaultName } = useModelVerification(kind, modelId, model);

  const score = row?.score ?? null;
  const text = modelKindText[kind];
  const isUsed = chosenId === modelId;
  // This account writes with it because it chose none: there is no choice to take back.
  const isUsedAsDefault = isUsed && !hasChoice;

  async function handleUse(isOn) {
    await choose(isOn ? row : null);
    haptics.selection();
  }

  async function handleResetScore() {
    const message = `${name} goes back to Not tried yet.`;
    if (!(await confirmAsync({ title: 'Reset score', message, action: 'Reset', destructive: true }))) return;
    await resetScores(getDb(), kind, modelId);
  }

  async function handleRemove() {
    if (defaultName) {
      Alert.alert(`${name} is the ${defaultName}`, `Make another model the ${defaultName} before you remove this one.`);
      return;
    }
    await removeYourModel(getDb(), kind, modelId);
    navigation.goBack();
  }

  function renderBody() {
    if (!rows) return <CatalogStatus error={error} retry={retry} />;
    return (
      <>
        <IntroText style={styles.intro}>
          {model ? modelDetailText(model, kind, score) : 'No longer available'}
        </IntroText>
        <Section>
          <Row label={text.useLabel} description={isUsedAsDefault ? "It's the default" : undefined}>
            <Switch
              value={isUsed}
              onValueChange={handleUse}
              disabled={!model || isUsedAsDefault}
              accessibilityLabel={text.useLabel}
            />
          </Row>
        </Section>
        <SectionFooter>{text.useFootnote}</SectionFooter>
        {model ? (
          <ModelLabelsSection kind={kind} model={model} />
        ) : (
          <SectionFooter>Venice no longer offers this model; its labels stay until it's back.</SectionFooter>
        )}
        <VerifySection kind={kind} modelId={modelId} name={name} model={model} />
        <Section isHeaderless>
          {score !== null && <Row label="Reset score" onPress={handleResetScore} />}
          <Row label="Remove" destructive onPress={handleRemove} />
        </Section>
      </>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title={name} onBack={() => navigation.goBack()} />
      <DetailScrollView>{renderBody()}</DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
    marginBottom: layout.introGap,
  },
});
