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
import ContactMenuRow from '@/features/contact-list/ContactMenuRow';
import ContactRow from '@/features/contact-list/ContactRow';
import type { BuiltInContactList } from '@/features/contact-list/builtInContactLists';
import contactQuery, { type ContactSummary } from '@/features/contact-list/contactQuery';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import useContactSort from '@/features/contact-list/useContactSort';
import useContacts from '@/features/contacts-context/useContacts';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout, space } from '@/styles/designTokens';
import type * as schema from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const keyExtractor = (contact: ContactSummary) => contact.id;

type ContactListProps = { list: schema.ContactListRow } | { builtIn: BuiltInContactList };

/**
 * A contact list's screen, searchable: a list of the user's (`list`) with its description (edited in
 * Edit list, from the ⋯ menu) and its contacts by name or by when they joined it (the Contacts tab's
 * sort), Add contacts in the header's pill, which is where a contact is taken out of it too; or a
 * built-in one (`builtIn`: Favorites, Tagged, Deleted), its contacts with their lists' pills, sorted
 * as its entry says, where a deleted contact's row restores it.
 */
export default function ContactList(props: ContactListProps) {
  const navigation = useNavigation();
  const { restoreContact } = useContacts();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { sortOrder, setSortOrder } = useContactSort();
  const { listRef, sort, searchBar, searchText: search } = useListControls({ onSort: setSortOrder });
  const attachList = useListRefCallback(listRef);
  const builtIn = 'builtIn' in props ? props.builtIn : undefined;
  const list = 'list' in props ? props.list : undefined;
  const isDeleted = builtIn?.scope === 'deleted';
  // Trimmed, so a trailing space doesn't read the list again.
  const query = contactQuery({
    scope: builtIn ? builtIn.scope : { listId: list!.id },
    search,
    sort: sortOrder,
    withLists: !!builtIn,
  });
  const { rows, count, loadMore } = usePagedQuery(query, 100);

  const lastIndex = (rows?.length ?? 0) - 1;
  // Stable while the rows' count is, so a keystroke doesn't re-render every row (they are memo).
  const renderItem = useCallback(
    ({ item: contact, index }: ListRenderItemInfo<ContactSummary>) =>
      isDeleted ? (
        <ContactRow
          contact={contact}
          onPress={() => restoreContact(contact.id)}
          trailing={<Button label="Restore" size="small" onPress={() => restoreContact(contact.id)} />}
          isFirst={index === 0}
          isLast={index === lastIndex}
        />
      ) : (
        <ContactMenuRow contact={contact} isFirst={index === 0} isLast={index === lastIndex} />
      ),
    [lastIndex, isDeleted, restoreContact],
  );

  const header = list?.notes ? (
    <Text variant="status" style={styles.description}>
      {list.notes}
    </Text>
  ) : undefined;

  return (
    <Page>
      <FloatingDetailHeader
        title={(builtIn ?? list!).name}
        subtitle={pluralizeText('1 contact', '%{count} contacts', count ?? 0)}
        onBack={() => navigation.goBack()}
        menuSlot={
          list && (
            <>
              <ContactListMenu list={list} afterDelete={() => navigation.goBack()} />
              <Button
                variant="primary"
                icon="add"
                onPress={() => router.navigate({ pathname: '/add-contacts', params: { listId: list.id } })}
                accessibilityLabel="Add contacts"
              />
            </>
          )
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
              icon={search ? 'search' : 'contacts'}
              title={search ? 'No contacts match' : (builtIn?.emptyTitle ?? 'No contacts in this list yet')}
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
        sortOptions={!builtIn || builtIn.isSortable ? contactSortOptions : []}
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
