import { COMPARE_MIN_MODELS } from '@squidbox/shared';
import { StyleSheet } from 'react-native';

import ModelRow from './ModelRow';
import modelKindText from './modelKindText';

import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import EmptyState from '@/components/EmptyState';
import IconMenuButton from '@/components/IconMenuButton';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import PrimaryButton from '@/components/PrimaryButton';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import TextButton from '@/components/TextButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { Section, SectionFooter } from '@/components/settings-list/SettingsList';
import startCheckAsync from '@/features/model-verify/startCheckAsync';
import useHaptics from '@/hooks/useHaptics';
import useHasFeature from '@/hooks/useHasFeature';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useYourModels from '@/hooks/useYourModels';
import { removeYourModel, resetScores } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import isVerifiedModel from '@/utils/ai/isVerifiedModel';
import confirmAsync from '@/utils/confirmAsync';

// Your models of one kind (route param `kind`: writing | vision), the one the assistant uses, and the
// way to add and remove them. For an ai_admin account also their scores from Compare, Compare, and
// in each row's menu the model's check and its marks (Verified, Uncensored, the defaults).
export default function ModelListScreen({ navigation, route }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const isAiAdmin = useHasFeature('ai_admin');
  const haptics = useHaptics();
  const paddingBottom = useFloatingPrimaryActionPadding();
  const { catalog, error, retry, rows, chosenId, choose } = useYourModels(kind);

  const availableCount = rows?.filter((row) => row.model !== null).length ?? 0;
  const hasScores = isAiAdmin && (rows?.some(({ score }) => score !== null) ?? false);
  const hasVerified = rows?.some((row) => row.model !== null && isVerifiedModel(kind, row.model)) ?? false;
  const text = modelKindText[kind];

  async function handleChoose(row) {
    if (row.id === chosenId) return;
    await choose(row);
    haptics.selection();
  }

  // Opens the model's last check, without starting one (the screen reads it).
  function handleShowCheck(row) {
    navigation.navigate('ModelCheckModal', { kind, modelId: row.id, name: row.name });
  }

  // Starts the model's check on the server, then opens it to watch.
  async function handleCheck(row) {
    const check = await startCheckAsync(kind, row.model, catalog);
    if (check) navigation.navigate('ModelCheckModal', { kind, modelId: row.id, name: row.name, check });
  }

  async function handleResetScore(row) {
    const message = `${row.name} goes back to Not tried yet.`;
    if (!(await confirmAsync({ title: 'Reset score', message, action: 'Reset', destructive: true }))) return;
    await resetScores(getDb(), kind, row.id);
  }

  async function handleResetAllScores() {
    const message = 'Every model in this list goes back to Not tried yet.';
    if (!(await confirmAsync({ title: 'Reset all scores', message, action: 'Reset', destructive: true }))) return;
    await resetScores(getDb(), kind);
  }

  function renderModels() {
    if (!rows) return <CatalogStatus error={error} retry={retry} />;
    if (rows.length === 0) return <EmptyState icon="cpu" title="No models yet" subtitle="Add a model to test." />;
    return (
      <>
        <Section>
          {rows.map((row) => (
            <ModelRow
              key={row.id}
              name={row.name}
              model={row.model}
              kind={kind}
              score={row.score}
              isChosen={row.id === chosenId}
              onChoose={() => handleChoose(row)}
              onShowCheck={() => handleShowCheck(row)}
              onCheck={() => handleCheck(row)}
              onResetScore={() => handleResetScore(row)}
              onRemove={() => removeYourModel(getDb(), kind, row.id)}
            />
          ))}
        </Section>
        {hasVerified && <SectionFooter>{text.verified}</SectionFooter>}
        {isAiAdmin && <SectionFooter>{text.footer}</SectionFooter>}
        {isAiAdmin && text.note && <SectionFooter>{text.note}</SectionFooter>}
      </>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader
        title={text.title}
        onBack={() => navigation.goBack()}
        menuSlot={
          hasScores && (
            <IconMenuButton accessibilityLabel="Score options">
              <MenuOption label="Reset all scores" icon="undo" onPress={handleResetAllScores} danger />
            </IconMenuButton>
          )
        }
      />
      <DetailScrollView contentContainerStyle={isAiAdmin && { paddingBottom }}>
        <IntroText style={styles.intro}>{text.intro}</IntroText>
        <ScreenSectionHeader
          title="Your models"
          rightSlot={
            catalog && (
              <TextButton
                label="Add"
                icon="add"
                size="small"
                onPress={() => navigation.navigate('AddAiModelsModal', { kind })}
              />
            )
          }
        />
        {renderModels()}
      </DetailScrollView>
      {isAiAdmin && (
        <FloatingPrimaryAction>
          <PrimaryButton
            icon="repeat"
            label="Compare"
            onPress={() => navigation.navigate('ModelCompareModal', { kind })}
            disabled={availableCount < COMPARE_MIN_MODELS}
          />
        </FloatingPrimaryAction>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
    paddingBottom: 4,
  },
});
