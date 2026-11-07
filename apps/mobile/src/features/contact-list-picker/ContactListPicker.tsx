import type { ContactListRecord } from '@squidbox/shared';
import { useDeferredValue, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import MenuButton from '@/components/MenuButton';
import SearchInput from '@/components/SearchInput';
import SelectIndicator from '@/components/SelectIndicator';
import SortFilterMenu from '@/components/floating-bars/SortFilterMenu';
import AddRow from '@/components/settings-list/AddRow';
import { Row, Section } from '@/components/settings-list/SettingsList';
import type { BuiltInContactListSummary } from '@/features/contact-list/builtInContactLists';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import shownContactLists from '@/features/contact-list/shownContactLists';
import useAddListAction from '@/features/contact-list/useAddListAction';
import useContactListRows from '@/features/contact-list/useContactListRows';
import useContactSort from '@/features/contact-list/useContactSort';
import { layout } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';
import toggleItem from '@/utils/toggleItem';

/**
 * The contact lists to choose from, under a search field that narrows them by name and a sort menu
 * beside it (the Lists tab's: shownContactLists, useContactSort('lists')), with "New list" at the end (a
 * new list is chosen too). `selectedIds` are the chosen lists' ids; `onChange` gets the new ones. `isSingle` chooses one: a tap gives `[thatId]`, the chosen one has
 * the accent check in front, where the selection circles are otherwise. `builtIns` are built-in lists
 * to offer among them, searched and sorted with them (Favorites, on the pin), as the Lists tab does.
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
  const lists = useContactListRows({ withMembers: false });
  const { sortOrder, setSortOrder: sortLists } = useContactSort('lists');
  const [typedText, setTypedText] = useState('');
  const searchText = useDeferredValue(typedText).trim();
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

  if (!lists || !shown) return null;

  return (
    <>
      <View style={styles.controls}>
        <SearchInput
          variant="field"
          placeholder="Search lists"
          accessibilityLabel="Search lists"
          value={typedText}
          onChangeText={setTypedText}
          clearButtonMode="while-editing"
          style={styles.search}
        />
        <MenuButton icon="options" accessibilityLabel="Sort lists">
          <SortFilterMenu sortOrder={sortOrder} sortOptions={contactSortOptions} onSort={sortLists} />
        </MenuButton>
      </View>
      {searchText && shown.length === 0 ? (
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
      )}
    </>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    marginBottom: layout.sectionGap,
  },
  search: {
    flex: 1,
  },
});
