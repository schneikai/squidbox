import type { ContactListRecord } from '@squidbox/shared';
import { useMemo } from 'react';
import { ScrollView, Text } from 'react-native';

import EmptyState from '@/components/EmptyState';
import SelectIndicator from '@/components/SelectIndicator';
import SheetSearchField from '@/components/SheetSearchField';
import AddRow from '@/components/settings-list/AddRow';
import { Row, Section } from '@/components/settings-list/SettingsList';
import type { BuiltInContactListSummary } from '@/features/contact-list/builtInContactLists';
import shownContactLists from '@/features/contact-list/shownContactLists';
import useAddListAction from '@/features/contact-list/useAddListAction';
import useContactListRows from '@/features/contact-list/useContactListRows';
import useSearchText from '@/hooks/useSearchText';
import useSheetSearchList from '@/hooks/useSheetSearchList';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';
import toggleItem from '@/utils/toggleItem';

/**
 * A sheet's body of contact lists to choose from, A to Z under a search field pinned under the header
 * (SheetSearchField), and "New list" at the end (a new list is chosen too). `selectedIds` are the chosen
 * lists' ids; `onChange` gets the new ones. `isSingle` chooses one: a tap gives `[thatId]`, the chosen
 * one has the accent check in front, where the selection circles are otherwise. `builtIns` are built-in
 * lists to offer among them, searched and ordered by name with them (Favorites, on the pin), as the
 * Lists screen does.
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
  const listProps = useSheetSearchList({ hasGutter: true });
  const lists = useContactListRows({ withMembers: false });
  const { field, searchText } = useSearchText();
  const promptAddList = useAddListAction({
    onAdded: (list: ContactListRecord) => onChange(isSingle ? [list.id] : [...selectedIds, list.id]),
    message: isSingle ? undefined : 'The list is made now, even if you close this without saving.',
  });

  const shown = useMemo(
    () => lists && shownContactLists([...(builtIns ?? []), ...lists], searchText, 'name:asc'),
    [lists, builtIns, searchText],
  );

  function handlePress(listId: string) {
    onChange(isSingle ? [listId] : toggleItem(selectedIds, listId));
  }

  return (
    <>
      <SheetSearchField {...field} placeholder="Search lists…" />
      <ScrollView {...listProps}>
        {/* The field shows at once, so it doesn't jump in when the lists arrive. */}
        {shown &&
          (searchText && shown.length === 0 ? (
            <EmptyState icon="search" title="No lists match" />
          ) : (
            <Section>
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
    </>
  );
}
