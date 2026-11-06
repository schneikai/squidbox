import { router, useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactListMenu from './ContactListMenu';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import Text from '@/components/Text';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import ContactRow from '@/features/contact-list/ContactRow';
import contactQuery, { type ContactSummary } from '@/features/contact-list/contactQuery';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import useContactSort from '@/features/contact-list/useContactSort';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout, space } from '@/styles/designTokens';
import type * as schema from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const keyExtractor = (contact: ContactSummary) => contact.id;

type ContactListProps = { list: schema.ContactListRow };

// A contact list: its description (edited in Edit list, from the ⋯ menu), then its contacts by name or
// by when they joined it (the Contacts tab's sort).
// Add contacts sits in the header's pill, and is where a contact is taken out of the list too.
export default function ContactList({ list }: ContactListProps) {
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { sortOrder, sortContacts } = useContactSort();
  const { listRef, sort, searchBar, searchText } = useListControls({ onSort: sortContacts });
  // Trimmed, so a trailing space doesn't read the list again.
  const query = contactQuery({ scope: { listId: list.id }, search: searchText.trim(), sort: sortOrder });
  const { rows, count, loadMore } = usePagedQuery(query, 100);
  const lastIndex = (rows?.length ?? 0) - 1;
  // Stable while the rows' count is, so a keystroke doesn't re-render every row (ContactRow is memo).
  const renderItem = useCallback(
    ({ item: contact, index }: ListRenderItemInfo<ContactSummary>) => (
      <ContactRow contact={contact} isFirst={index === 0} isLast={index === lastIndex} />
    ),
    [lastIndex],
  );
  const attachList = useListRefCallback(listRef);

  const header = list.notes ? (
    <Text variant="status" style={styles.description}>
      {list.notes}
    </Text>
  ) : undefined;

  return (
    <Page>
      <FloatingDetailHeader
        title={list.name}
        subtitle={pluralizeText('1 contact', '%{count} contacts', count ?? 0)}
        onBack={() => navigation.goBack()}
        menuSlot={
          <>
            <ContactListMenu list={list} afterDelete={() => navigation.goBack()} />
            <Button
              variant="primary"
              icon="add"
              onPress={() => router.navigate({ pathname: '/add-contacts', params: { listId: list.id } })}
              accessibilityLabel="Add contacts"
            />
          </>
        }
      />
      <Animated.FlatList
        ref={attachList}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListEmptyComponent={
          rows ? (
            <EmptyState
              icon={searchText.trim() ? 'search' : 'contacts'}
              title={searchText.trim() ? 'No contacts match' : 'No contacts in this list yet'}
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
  description: {
    paddingHorizontal: layout.rowInset, // over the rows' text, as the section headers are
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
});
