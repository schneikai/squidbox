import { type AiModelKind, COMPARE_MIN_MODELS } from '@squidbox/shared';
import { router, useNavigation } from 'expo-router';

import ModelDefaultsActions from './ModelDefaultsActions';
import ModelRow from './ModelRow';
import modelKindText from './modelKindText';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import MenuButton from '@/components/MenuButton';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import AddRow from '@/components/settings-list/AddRow';
import { Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useModelKindParam from '@/hooks/useModelKindParam';
import useYourModels, { type YourModelRow } from '@/hooks/useYourModels';
import { resetScores } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import confirmAsync from '@/utils/confirmAsync';

// Your models of one kind (route param `kind`: writing | vision), with their labels and the way to
// add them; a row opens the model's page (ModelScreen: its labels, Verify and Remove), their scores
// from Compare, and Compare. While your picks of the defaults differ from everyone's, the list ends
// with Apply changes for everyone and Reset changes (ModelDefaultsActions). An ai_admin tool.
export default function ModelListScreen() {
  const kind = useModelKindParam();
  if (kind === null) return null;
  return <ModelList kind={kind} />;
}

type ModelListProps = { kind: AiModelKind };

function ModelList({ kind }: ModelListProps) {
  const navigation = useNavigation();
  const paddingBottom = useFloatingPrimaryActionPadding();
  const { defaults, yourDefaults, isChanged, error, retry, rows, readDefaultsToApply, publishDefaults, resetDefaults } =
    useYourModels(kind);

  const availableCount = rows?.filter((row) => row.model !== null).length ?? 0;
  const hasScores = rows?.some(({ score }) => (score ?? 0) > 0) ?? false;
  const text = modelKindText[kind];

  function handleOpen(row: YourModelRow) {
    router.navigate({
      pathname: '/settings/assistant/models/[kind]/[modelId]',
      params: { kind, modelId: row.id, name: row.name },
    });
  }

  async function handleResetAllScores() {
    const message = 'Every model in this list loses its thumbs up.';
    if (!(await confirmAsync({ title: 'Reset all scores', message, action: 'Reset', destructive: true }))) return;
    await resetScores(getDb(), kind);
  }

  function renderModels() {
    if (!rows) return <CatalogStatus error={error} retry={retry} />;
    return (
      <>
        <Section>
          {rows.map((row) => (
            <ModelRow
              key={row.id}
              id={row.id}
              name={row.name}
              model={row.model}
              kind={kind}
              score={row.score}
              note={row.note}
              yourDefaults={yourDefaults}
              defaults={defaults}
              onOpen={() => handleOpen(row)}
            />
          ))}
          <AddRow label="Add a model" onPress={() => router.navigate(`/settings/assistant/models/${kind}/add`)} />
        </Section>
        <SectionFooter>{text.footer}</SectionFooter>
        {text.note && <SectionFooter>{text.note}</SectionFooter>}
        {isChanged && (
          <ModelDefaultsActions
            kind={kind}
            readDefaultsToApply={readDefaultsToApply}
            publishDefaults={publishDefaults}
            resetDefaults={resetDefaults}
            isScreenEnd
          />
        )}
      </>
    );
  }

  return (
    <Page>
      <FloatingDetailHeader
        title={text.title}
        onBack={() => navigation.goBack()}
        menuSlot={
          hasScores && (
            <MenuButton accessibilityLabel="Score options">
              <MenuOption label="Reset all scores" icon="undo" onPress={handleResetAllScores} colorPalette="danger" />
            </MenuButton>
          )
        }
      />
      <DetailScrollView contentContainerStyle={{ paddingBottom }}>
        <IntroText isScreenIntro>{text.intro}</IntroText>
        <ScreenSectionHeader title="Your models" />
        {renderModels()}
      </DetailScrollView>
      <FloatingPrimaryAction>
        <Button
          variant="primary"
          icon="thumbs-up"
          label="Compare"
          onPress={() => router.navigate(`/compare/${kind}`)}
          disabled={availableCount < COMPARE_MIN_MODELS}
        />
      </FloatingPrimaryAction>
    </Page>
  );
}
