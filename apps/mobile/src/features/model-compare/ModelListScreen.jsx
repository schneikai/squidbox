import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPrimaryAction, { FLOATING_PRIMARY_ACTION_CLEARANCE } from './FloatingPrimaryAction';
import ModelRow from './ModelRow';
import joinYourModels from './joinYourModels';
import modelKindText from './modelKindText';
import modelsOfKind from './modelsOfKind';
import seedModels from './seedModels';
import useAiCatalog from './useAiCatalog';
import useLeaveWhenUnavailable from './useLeaveWhenUnavailable';

import DetailScrollView from '@/components/DetailScrollView';
import EmptyState from '@/components/EmptyState';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import PrimaryButton from '@/components/PrimaryButton';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import TextButton from '@/components/TextButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { colors } from '@/styles/designTokens';
import { readModelList, removeYourModel, seedYourModels, setChosenModel } from '@/sync/aiStateRepository';
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
  // undefined while reading, null before the list was seeded
  const list = useLiveQuery(
    (db) => readModelList(db, kind),
    [schema.aiKinds, schema.aiModels, schema.aiScores],
    [kind],
  );

  // First run: your list starts with the owner's picks that Venice still has.
  const needsSeed = !!catalog && list === null;
  useEffect(() => {
    if (needsSeed) seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind));
  }, [needsSeed]);

  const rows = catalog && list ? joinYourModels(list.models, catalog, kind) : null;
  const availableRows = rows?.filter((row) => row.model !== null) ?? [];
  const text = modelKindText[kind];

  async function handleChoose(row) {
    if (row.id === list.chosenId) return;
    await setChosenModel(getDb(), kind, row.id);
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
              name={row.name}
              model={row.model}
              kind={kind}
              score={row.score}
              isChosen={row.id === list.chosenId}
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
      <DetailScrollView contentContainerStyle={{ paddingBottom: bottom + FLOATING_PRIMARY_ACTION_CLEARANCE }}>
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
      <FloatingPrimaryAction>
        <PrimaryButton icon="repeat" label="Compare" onPress={handleCompare} disabled={availableRows.length < 2} />
      </FloatingPrimaryAction>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 4,
  },
  status: {
    paddingVertical: 40,
  },
});
