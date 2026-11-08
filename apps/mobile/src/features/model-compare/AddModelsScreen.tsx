import type { AiModelKind, ApiAiModel } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, type ListRenderItemInfo } from 'react-native';

import AddModelRow from './AddModelRow';
import searchModels from './searchModels';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import Divider from '@/components/Divider';
import EmptyState from '@/components/EmptyState';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import useHaptics from '@/hooks/useHaptics';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useModelKindParam from '@/hooks/useModelKindParam';
import useScreenPadding from '@/hooks/useScreenPadding';
import useYourModels from '@/hooks/useYourModels';
import { addYourModel, readRemovedModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import modelsOfKind from '@/utils/ai/modelsOfKind';

// Every model Venice offers for a kind (route param `kind`), with search in the floating bar at the
// bottom left; a tap adds one to your list. Removing is on the model's page; a removed model shows its score and note here.
export default function AddModelsScreen() {
  const kind = useModelKindParam();
  if (kind === null) return null;
  return <AddModels kind={kind} />;
}

type AddModelsProps = { kind: AiModelKind };

function AddModels({ kind }: AddModelsProps) {
  const navigation = useNavigation();
  const { listRef, searchBar, searchText } = useListControls();
  const attachList = useListRefCallback(listRef);
  const padding = useScreenPadding('sheet-bar');
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
    async (model: ApiAiModel) => {
      await addYourModel(getDb(), kind, model);
      haptics.selection();
    },
    [kind, haptics],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ApiAiModel>) => (
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

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Add models"
      />
      <FlatList
        ref={attachList}
        data={models}
        keyExtractor={(model) => model.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={renderEmpty()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={padding}
      />
      <SearchSortFilterBar search={searchBar} placeholder="Search models…" />
    </ModalSheet>
  );
}
