import { useNavigation } from '@react-navigation/native';

import ModelLabelsSection from './ModelLabelsSection';
import VerifySection from './VerifySection';
import alertDefaultHeld from './alertDefaultHeld';
import useModelVerification from './useModelVerification';

import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import ScoreDetail from '@/components/ScoreDetail';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useYourModels from '@/hooks/useYourModels';
import { removeYourModel, resetScores } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import modelDetailText from '@/utils/ai/modelDetailText';
import scoreDetailLabel from '@/utils/ai/scoreDetailLabel';
import confirmAsync from '@/utils/confirmAsync';

/**
 * A model of your list (route params `kind`, `modelId`, `name`; an ai_admin tool): its grey line,
 * its labels (marks every account sees, and this account's picks of the defaults), its Verify, and
 * Reset score and Remove. A model Venice no longer offers keeps its page, to read its Verify and
 * remove it.
 */
export default function ModelScreen({ route }) {
  const { kind, modelId, name } = route.params;
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const yourModels = useYourModels(kind);
  const { error, retry, rows } = yourModels;

  const row = rows?.find((each) => each.id === modelId);
  // The catalog's model, null once Venice no longer offers it.
  const model = row?.model ?? null;
  const verification = useModelVerification(kind, { modelId, name, model }, yourModels);

  const score = row?.score;
  const detail = model ? modelDetailText(model, kind) : null;

  async function handleResetScore() {
    const message = `${name} loses its thumbs up.`;
    if (!(await confirmAsync({ title: 'Reset score', message, action: 'Reset', destructive: true }))) return;
    await resetScores(getDb(), kind, modelId);
  }

  async function handleRemove() {
    if (verification.defaultName) {
      alertDefaultHeld(name, verification.defaultName);
      return;
    }
    await removeYourModel(getDb(), kind, modelId);
    navigation.goBack();
  }

  function renderBody() {
    if (!rows) return <CatalogStatus error={error} retry={retry} />;
    return (
      <>
        <IntroText isScreenIntro accessibilityLabel={detail ? scoreDetailLabel(score, detail) : undefined}>
          {detail ? <ScoreDetail score={score} detail={detail} /> : 'No longer available'}
        </IntroText>
        {model ? (
          <ModelLabelsSection kind={kind} model={model} verification={verification} />
        ) : (
          <SectionFooter>Venice no longer offers this model; its labels stay until it's back.</SectionFooter>
        )}
        <VerifySection kind={kind} modelId={modelId} name={name} model={model} />
        <Section isHeaderless>
          {score > 0 && <Row label="Reset score" onPress={handleResetScore} />}
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
