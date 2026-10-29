import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddModelRow from './AddModelRow';
import searchModels from './searchModels';

import CatalogStatus from '@/components/CatalogStatus';
import EmptyState from '@/components/EmptyState';
import ListDivider from '@/components/ListDivider';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SearchInput from '@/components/SearchInput';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useScrollY from '@/hooks/useScrollY';
import useYourModels from '@/hooks/useYourModels';
import { addYourModel } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import modelsOfKind from '@/utils/ai/modelsOfKind';

// Every model Venice offers for a kind (route param `kind`), with a search box; a tap adds one to
// your list. Removing is on the model's page.
export default function AddModelsScreen({ navigation, route }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const [searchText, setSearchText] = useState('');
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const haptics = useHaptics();
  const { catalog, defaults, yourDefaults, error, retry, rows } = useYourModels(kind);

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
        isAdded={addedIds.has(item.id)}
        onAdd={handleAdd}
      />
    ),
    [kind, yourDefaults, defaults, addedIds, handleAdd],
  );

  function renderEmpty() {
    if (!catalog) return <CatalogStatus error={error} retry={retry} />;
    return <EmptyState icon="search" title="No models match" />;
  }

  if (!isAvailable) return null;

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
});
