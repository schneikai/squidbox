import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddModelRow from './AddModelRow';
import { addYourModel, readYourModels } from './aiState';
import modelsOfKind from './modelsOfKind';
import searchModels from './searchModels';

import EmptyState from '@/components/EmptyState';
import ListDivider from '@/components/ListDivider';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SearchInput from '@/components/SearchInput';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import useScrollY from '@/hooks/useScrollY';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Every model Venice offers for a kind (route params `kind` and the fetched `catalog`), with a
// search box; a tap adds one to your list. Removing is in the list's row menu.
export default function AddModelsScreen({ navigation, route }) {
  const { kind, catalog } = route.params;
  const [searchText, setSearchText] = useState('');
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const haptics = useHaptics();
  const yourModels = useLiveQuery((db) => readYourModels(db, kind), [schema.aiState], [kind]);

  const addedIds = new Set((yourModels ?? []).map(({ id }) => id));
  const models = searchModels(modelsOfKind(catalog, kind), searchText);

  async function handleAdd(model) {
    if (addedIds.has(model.id)) return;
    await addYourModel(getDb(), kind, model);
    haptics.selection();
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
        renderItem={({ item }) => (
          <AddModelRow model={item} kind={kind} isAdded={addedIds.has(item.id)} onAdd={() => handleAdd(item)} />
        )}
        extraData={yourModels}
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
        ListEmptyComponent={<EmptyState icon="search" title="No models match" />}
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
