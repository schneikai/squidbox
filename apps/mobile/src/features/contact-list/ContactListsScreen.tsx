import { useNavigation } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactListRows from './ContactListRows';
import contactSortOptions from './contactSortOptions';
import shownContactLists from './shownContactLists';
import useAddListAction from './useAddListAction';
import useBuiltInContactListRows from './useBuiltInContactListRows';
import useContactListRows from './useContactListRows';
import useContactSort from './useContactSort';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

const NO_ROWS: never[] = [];

/**
 * The contact lists, pushed from the Contacts tab's All lists: the built-in ones (Favorites, Tagged,
 * Deleted) among the user's, each opening its list, searched by name and sorted with the lists' own
 * sort (useContactSort('lists'), the list picker's too). + adds a list.
 */
export default function ContactListsScreen() {
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { sortOrder, setSortOrder } = useContactSort('lists');
  const { listRef, sort, searchBar, searchText } = useListControls({ onSort: setSortOrder });
  const attachList = useListRefCallback(listRef);
  const promptAddList = useAddListAction();
  const lists = useContactListRows();
  const builtInLists = useBuiltInContactListRows();

  const allLists = useMemo(() => lists && builtInLists && [...builtInLists, ...lists], [lists, builtInLists]);
  const shownLists = useMemo(
    () => allLists && shownContactLists(allLists, searchText, sortOrder),
    [allLists, searchText, sortOrder],
  );

  // The lists are one card (ContactListRows), so the list has no rows of its own: it is a FlatList for the
  // scrollToOffset that a new sort calls (useListControls).
  const header =
    shownLists &&
    (shownLists.length > 0 ? (
      <ContactListRows lists={shownLists} />
    ) : (
      <EmptyState icon="search" title="No lists match" />
    ));

  return (
    <Page>
      <FloatingDetailHeader
        title="Lists"
        subtitle={allLists && pluralizeText('1 list', '%{count} lists', allLists.length)}
        onBack={() => navigation.goBack()}
        menuSlot={<Button variant="primary" icon="add" onPress={promptAddList} accessibilityLabel="Add list" />}
      />
      <Animated.FlatList
        ref={attachList}
        data={NO_ROWS}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        keyboardDismissMode="on-drag"
      />
      <SearchSortFilterBar
        search={searchBar}
        placeholder="Search lists…"
        sortOrder={sortOrder}
        sortOptions={contactSortOptions}
        onSort={sort}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
  },
});
