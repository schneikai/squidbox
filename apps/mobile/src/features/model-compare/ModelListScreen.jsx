import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelRow from './ModelRow';
import PinnedAction, { PINNED_ACTION_CLEARANCE } from './PinnedAction';
import {
  readChosenModel,
  readScores,
  readYourModels,
  removeYourModel,
  seedYourModels,
  setChosenModel,
} from './aiState';
import joinYourModels from './joinYourModels';
import modelKindText from './modelKindText';
import modelsOfKind from './modelsOfKind';
import seedModels from './seedModels';
import useAiCatalog from './useAiCatalog';
import useLeaveWhenUnavailable from './useLeaveWhenUnavailable';

import DetailScrollView from '@/components/DetailScrollView';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import PrimaryButton from '@/components/PrimaryButton';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import TextButton from '@/components/TextButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { colors, lineHeights, typography } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Your models of one kind (route param `kind`: writing | vision), the one the assistant uses, their
// scores from Compare, and the way to add, remove and compare them.
export default function ModelListScreen({ navigation, route }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const haptics = useHaptics();
  const { bottom } = useSafeAreaInsets();
  const { models: catalog, error, retry } = useAiCatalog();
  const state = useLiveQuery(
    async (db) => ({
      yourModels: await readYourModels(db, kind),
      scores: await readScores(db, kind),
      chosenId: (await readChosenModel(db, kind))?.id ?? null,
    }),
    [schema.aiState],
    [kind],
  );

  // First run: your list starts with the owner's picks that Venice still has.
  const needsSeed = !!catalog && state?.yourModels === null;
  useEffect(() => {
    if (needsSeed) seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind));
  }, [needsSeed]);

  const rows = catalog && state?.yourModels ? joinYourModels(state.yourModels, catalog, kind) : null;
  const availableRows = rows?.filter((row) => row.model !== null) ?? [];
  const text = modelKindText[kind];

  async function handleChoose(row) {
    if (row.id === state.chosenId) return;
    await setChosenModel(getDb(), kind, row);
    haptics.selection();
  }

  function handleCompare() {
    navigation.navigate('ModelCompareModal', { kind, models: availableRows.map(({ id, name }) => ({ id, name })) });
  }

  function renderModels() {
    if (error) {
      return (
        <View style={styles.status}>
          <EmptyState icon="alert" title="Couldn't load the models" subtitle={error} />
          <TextButton label="Try again" onPress={retry} />
        </View>
      );
    }
    if (!rows) return <ActivityIndicator style={styles.status} color={colors.text.secondary} />;
    if (rows.length === 0) return <EmptyState icon="cpu" title="No models yet" subtitle="Add a model to test." />;
    return (
      <>
        <Section>
          {rows.map((row) => (
            <ModelRow
              key={row.id}
              row={row}
              kind={kind}
              score={state.scores[row.id] ?? 0}
              isChosen={row.id === state.chosenId}
              onChoose={() => handleChoose(row)}
              onRemove={() => removeYourModel(getDb(), kind, row.id)}
            />
          ))}
        </Section>
        <SectionFooter>{text.footer}</SectionFooter>
      </>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title={text.title} onBack={() => navigation.goBack()} />
      <DetailScrollView contentContainerStyle={{ paddingBottom: bottom + PINNED_ACTION_CLEARANCE }}>
        <Text style={styles.intro}>{text.intro}</Text>
        <ScreenSectionHeader
          title="Your models"
          rightSlot={
            catalog && (
              <TextButton
                label="Add"
                icon="add"
                size="small"
                onPress={() => navigation.navigate('AddAiModelsModal', { kind, catalog })}
              />
            )
          }
        />
        {renderModels()}
      </DetailScrollView>
      <PinnedAction>
        <PrimaryButton icon="repeat" label="Compare" onPress={handleCompare} disabled={availableRows.length < 2} />
      </PinnedAction>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 4,
    lineHeight: lineHeights.footnote,
  },
  status: {
    paddingVertical: 40,
  },
});
