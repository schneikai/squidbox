import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddModelRow from './AddModelRow';
import searchModels from './searchModels';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import Divider from '@/components/Divider';
import EmptyState from '@/components/EmptyState';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SearchInput from '@/components/SearchInput';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useYourModels from '@/hooks/useYourModels';
import { space } from '@/styles/designTokens';
import { addYourModel, readRemovedModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import modelsOfKind from '@/utils/ai/modelsOfKind';

// Every model Venice offers for a kind (route param `kind`), with a search box; a tap adds one to
// your list. Removing is on the model's page; a removed model shows its score and note here.
export default function AddModelsScreen() {
  const navigation = useNavigation();
  const { kind } = useLocalSearchParams();
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const [searchText, setSearchText] = useState('');
  const { bottom } = useSafeAreaInsets();
  const haptics = useHaptics();
  const { catalog, defaults, yourDefaults, error, retry, rows } = useYourModels(kind);
  const removed = useLiveQuery((db) => readRemovedModels(db, kind), [schema.aiModels, schema.aiScores], [kind]);

  const addedIds = useMemo(() => new Set((rows ?? []).map(({ id }) => id)), [rows]);
  const models = useMemo(
    () => (catalog ? searchModels(modelsOfKind(catalog, kind), searchText) : []),
    [catalog, kind, searchText],
  );
  // Stable, so the memoized rows keep it; an added row can't be tapped again.
  const handleAdd = useCallback(
    async (model) => {
      await addYourModel(getDb(), kind, model);
      haptics.selection();
    },
    [kind, haptics],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <AddModelRow
        model={item}
        kind={kind}
        yourDefaults={yourDefaults}
        defaults={defaults}
        removed={removed?.get(item.id)}
        isAdded={addedIds.has(item.id)}
        onAdd={handleAdd}
      />
    ),
    [kind, yourDefaults, defaults, removed, addedIds, handleAdd],
  );

  function renderEmpty() {
    if (!catalog) return <CatalogStatus error={error} retry={retry} />;
    return <EmptyState icon="search" title="No models match" />;
  }

  if (!isAvailable) return null;

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Add models"
      />
      <FlatList
        data={models}
        keyExtractor={(model) => model.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <SearchInput
            variant="field"
            placeholder="Search models"
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
            style={styles.search}
          />
        }
        ListEmptyComponent={renderEmpty()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + SCREEN_PADDING }}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: SCREEN_PADDING,
    marginBottom: space.sm,
  },
});
