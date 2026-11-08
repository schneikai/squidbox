import type { ContactListRecord } from '@squidbox/shared';
import { type ComponentRef, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '@/components/EmptyState';
import SelectIndicator from '@/components/SelectIndicator';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import AddRow from '@/components/settings-list/AddRow';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import type { BuiltInContactListSummary } from '@/features/contact-list/builtInContactLists';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import shownContactLists from '@/features/contact-list/shownContactLists';
import useAddListAction from '@/features/contact-list/useAddListAction';
import useContactListRows from '@/features/contact-list/useContactListRows';
import useContactSort from '@/features/contact-list/useContactSort';
import useListControls from '@/hooks/useListControls';
import { layout } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';
import toggleItem from '@/utils/toggleItem';

/**
 * A sheet's body of contact lists to choose from, with search and the Lists screen's sort
 * (shownContactLists, useContactSort('lists')) in the floating bar at the bottom left, and "New list"
 * at the end (a new list is chosen too). `selectedIds` are the chosen lists' ids; `onChange` gets the
 * new ones. `isSingle` chooses one: a tap gives `[thatId]`, the chosen one has the accent check in
 * front, where the selection circles are otherwise. `builtIns` are built-in lists to offer among them,
 * searched and sorted with them (Favorites, on the pin), as the Lists screen does.
 */
type ContactListPickerProps = {
  selectedIds: string[];
  onChange: (listIds: string[]) => void;
  isSingle?: boolean;
  builtIns?: readonly BuiltInContactListSummary[];
};

export default function ContactListPicker({
  selectedIds,
  onChange,
  isSingle = false,
  builtIns,
}: ContactListPickerProps) {
  const { bottom } = useSafeAreaInsets();
  const lists = useContactListRows({ withMembers: false });
  const { sortOrder, setSortOrder } = useContactSort('lists');
  const { listRef, sort, searchBar, searchText: typedSearch } = useListControls({ onSort: setSortOrder });
  const searchText = typedSearch.trim();
  // A ScrollView scrolls to an offset with scrollTo.
  const attachList = useCallback(
    (scrollView: ComponentRef<typeof ScrollView> | null) => {
      listRef.current = scrollView && {
        scrollToOffset: ({ animated, offset }) => scrollView.scrollTo({ y: offset, animated }),
      };
    },
    [listRef],
  );
  const promptAddList = useAddListAction({
    onAdded: (list: ContactListRecord) => onChange(isSingle ? [list.id] : [...selectedIds, list.id]),
    message: isSingle ? undefined : 'The list is made now, even if you close this without saving.',
  });

  const shown = useMemo(
    () => lists && shownContactLists([...(builtIns ?? []), ...lists], searchText, sortOrder),
    [lists, builtIns, searchText, sortOrder],
  );

  function handlePress(listId: string) {
    onChange(isSingle ? [listId] : toggleItem(selectedIds, listId));
  }

  return (
    <>
      <ScrollView
        ref={attachList}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + layout.barClearance }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {shown &&
          (searchText && shown.length === 0 ? (
            <EmptyState icon="search" title="No lists match" />
          ) : (
            <Section isHeaderless>
              {shown.map((list) => {
                const isSelected = selectedIds.includes(list.id);
                return (
                  <Row
                    key={list.id}
                    label={list.name}
                    leading={isSingle ? undefined : <SelectIndicator isSelected={isSelected} />}
                    isSelected={isSingle ? isSelected : undefined}
                    onPress={() => handlePress(list.id)}
                  >
                    <Text style={listTextStyles.subtitle}>
                      {pluralizeText('1 contact', '%{count} contacts', list.memberCount)}
                    </Text>
                  </Row>
                );
              })}
              <AddRow label="New list" onPress={promptAddList} />
            </Section>
          ))}
      </ScrollView>
      <SearchSortFilterBar
        search={searchBar}
        placeholder="Search lists…"
        sortOrder={sortOrder}
        sortOptions={contactSortOptions}
        onSort={sort}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: layout.sheetContentTop,
    paddingHorizontal: SCREEN_PADDING,
  },
});
