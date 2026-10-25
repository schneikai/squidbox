import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddModelRow from './AddModelRow';
import modelsOfKind from './modelsOfKind';
import searchModels from './searchModels';
import useAiCatalog from './useAiCatalog';

import EmptyState from '@/components/EmptyState';
import ListDivider from '@/components/ListDivider';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SearchInput from '@/components/SearchInput';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import useScrollY from '@/hooks/useScrollY';
import { colors } from '@/styles/designTokens';
import { addYourModel, readModelList } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Every model Venice offers for a kind (route param `kind`), with a search box; a tap adds one to
// your list. Removing is in the list's row menu.
export default function AddModelsScreen({ navigation, route }) {
  const { kind } = route.params;
  const [searchText, setSearchText] = useState('');
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const haptics = useHaptics();
  const { models: catalog, error } = useAiCatalog();
  const list = useLiveQuery(
    (db) => readModelList(db, kind),
    [schema.aiKinds, schema.aiModels, schema.aiScores],
    [kind],
  );

  const addedIds = useMemo(() => new Set((list?.models ?? []).map(({ id }) => id)), [list]);
  const models = useMemo(
    () => (catalog ? searchModels(modelsOfKind(catalog, kind), searchText) : []),
    [catalog, kind, searchText],
  );
  // The adds read the latest ids through a ref, so the rows' onAdd never changes.
  const addedIdsRef = useRef(addedIds);
  addedIdsRef.current = addedIds;

  const handleAdd = useCallback(
    async (model) => {
      if (addedIdsRef.current.has(model.id)) return;
      await addYourModel(getDb(), kind, model);
      haptics.selection();
    },
    [kind, haptics],
  );

  const renderItem = useCallback(
    ({ item }) => <AddModelRow model={item} kind={kind} isAdded={addedIds.has(item.id)} onAdd={handleAdd} />,
    [kind, addedIds, handleAdd],
  );

  function renderEmpty() {
    if (error) return <EmptyState icon="alert" title="Couldn't load the models" subtitle={error} />;
    if (!catalog) return <ActivityIndicator style={styles.loading} color={colors.text.secondary} />;
    return <EmptyState icon="search" title="No models match" />;
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Add models"
        scrollY={scrollY}
      />
      <Animated.FlatList
        data={models}
        keyExtractor={(model) => model.id}
        renderItem={renderItem}
        ItemSeparatorComponent={ListDivider}
        ListHeaderComponent={
          <SearchInput
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
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + SCREEN_PADDING }}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 8,
  },
  loading: {
    paddingVertical: 40,
  },
});
