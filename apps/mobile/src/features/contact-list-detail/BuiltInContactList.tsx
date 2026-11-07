import { useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import ContactRow from '@/features/contact-list/ContactRow';
import ContactRowMenu from '@/features/contact-list/ContactRowMenu';
import type { BuiltInContactList as BuiltInList } from '@/features/contact-list/builtInContactLists';
import contactQuery, { type ContactSummary } from '@/features/contact-list/contactQuery';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import useContactSort from '@/features/contact-list/useContactSort';
import useContacts from '@/features/contacts-context/useContacts';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const keyExtractor = (contact: ContactSummary) => contact.id;

const EMPTY_TITLES: Record<BuiltInList['id'], string> = {
  favorites: 'No favorites yet',
  tagged: 'No one is tagged yet',
  deleted: 'No deleted contacts',
};

type BuiltInContactListProps = { list: BuiltInList };

// A built-in list (Favorites, Tagged, Deleted): its contacts, searchable. Favorites keep the order they
// were favorited in and Deleted the order they were deleted in (newest first); Tagged sorts as the
// Contacts tab does. A deleted contact's row restores it.
export default function BuiltInContactList({ list }: BuiltInContactListProps) {
  const navigation = useNavigation();
  const { restoreContact } = useContacts();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { sortOrder, sortContacts } = useContactSort();
  const { listRef, sort, searchBar, searchText } = useListControls({ onSort: sortContacts });
  // Trimmed, so a trailing space doesn't read the list again.
  const query = contactQuery({ scope: list.scope, search: searchText.trim(), sort: sortOrder, withLists: true });
  const { rows, count, loadMore } = usePagedQuery(query, 100);
  const attachList = useListRefCallback(listRef);
  const isDeleted = list.id === 'deleted';

  const lastIndex = (rows?.length ?? 0) - 1;
  // Stable while the rows' count is, so a keystroke doesn't re-render every row (ContactRow is memo).
  const renderItem = useCallback(
    ({ item: contact, index }: ListRenderItemInfo<ContactSummary>) => (
      <ContactRow
        contact={contact}
        onPress={isDeleted ? () => restoreContact(contact.id) : undefined}
        trailing={
          isDeleted ? (
            <Button label="Restore" size="small" onPress={() => restoreContact(contact.id)} />
          ) : (
            <ContactRowMenu contact={contact} />
          )
        }
        isFirst={index === 0}
        isLast={index === lastIndex}
      />
    ),
    [lastIndex, isDeleted, restoreContact],
  );

  const isSearching = !!searchText.trim();

  return (
    <Page>
      <FloatingDetailHeader
        title={list.name}
        subtitle={pluralizeText('1 contact', '%{count} contacts', count ?? 0)}
        onBack={() => navigation.goBack()}
      />
      <Animated.FlatList
        ref={attachList}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={
          rows ? (
            <EmptyState
              icon={isSearching ? 'search' : 'contacts'}
              title={isSearching ? 'No contacts match' : EMPTY_TITLES[list.id]}
            />
          ) : undefined
        }
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        onEndReached={rows ? loadMore : undefined}
        onEndReachedThreshold={2}
        keyboardDismissMode="on-drag"
      />
      <SearchSortFilterBar
        search={searchBar}
        placeholder="Search contacts…"
        sortOrder={sortOrder}
        sortOptions={list.id === 'tagged' ? contactSortOptions : []}
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
