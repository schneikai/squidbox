import { router, useNavigation } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactListMenu from './ContactListMenu';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import ContactRow from '@/features/contact-list/ContactRow';
import contactQuery from '@/features/contact-list/contactQuery';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { colors, layout, typography } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const keyExtractor = (contact) => contact.id;

// A contact list: its description (edited in Edit list, from the ⋯ menu), then its contacts by name.
// Add contacts sits in the header's pill, and is where a contact is taken out of the list too.
export default function ContactList({ list }) {
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { listRef, searchBar, searchText } = useListControls();
  const query = contactQuery({ scope: { listId: list.id }, search: searchText });
  const { rows, count, loadMore } = usePagedQuery(query, 100);

  function renderItem({ item: contact, index }) {
    return <ContactRow contact={contact} isFirst={index === 0} isLast={index === rows.length - 1} />;
  }

  const header = list.notes ? <Text style={styles.description}>{list.notes}</Text> : null;

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
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListEmptyComponent={
          rows && (
            <EmptyState
              icon={searchText.trim() ? 'search' : 'contacts'}
              title={searchText.trim() ? 'No contacts match' : 'No contacts in this list yet'}
            />
          )
        }
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        onEndReached={rows ? loadMore : undefined}
        onEndReachedThreshold={2}
        keyboardDismissMode="on-drag"
      />
      <SearchSortFilterBar search={searchBar} placeholder="Search contacts…" />
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
  },
  description: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 16,
    fontSize: typography.subheadline,
    lineHeight: 21,
    color: colors.text.secondary,
  },
});
