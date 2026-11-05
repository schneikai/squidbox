import { router } from 'expo-router';
import { type RefObject, useState } from 'react';
import { type FlatList, type ListRenderItemInfo, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactAvatarRow from './ContactAvatarRow';
import ContactListRows from './ContactListRows';
import ContactRow from './ContactRow';
import ContactRowMenu from './ContactRowMenu';
import contactQuery from './contactQuery';
import contactSortOptions from './contactSortOptions';
import useAddListAction from './useAddListAction';
import useContactListRows from './useContactListRows';
import useContactRows from './useContactRows';
import useContactSort from './useContactSort';

import EmptyState from '@/components/EmptyState';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import SegmentedPill, { type SegmentedPillItem } from '@/components/floating-bars/SegmentedPill';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import type * as schema from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

type Segment = 'contacts' | 'lists';

const SEGMENTS: SegmentedPillItem<Segment>[] = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'lists', label: 'Lists' },
];
const PAGE_SIZE = 100;
const keyExtractor = (contact: schema.ContactRow) => contact.id;

// The Contacts tab: the contacts (favorites first as a row of avatars, then everyone, by name or recently added) or
// the contact lists, switched with the Contacts | Lists pill that is the header's title. + adds a contact, or a list.
export default function ContactsScreen() {
  const [segment, setSegment] = useState<Segment>('contacts');
  const { paddingTop, paddingBottom } = useScreenPadding('main');
  const { sortOrder, sortContacts } = useContactSort();
  const { listRef, sort, searchBar, searchText } = useListControls({ onSort: sortContacts });
  const scrollHandler = useFloatingBarScrollHandler();
  const promptAddList = useAddListAction();

  const query = contactQuery({ scope: 'all', search: searchText, sort: sortOrder });
  const { rows, count, loadMore } = usePagedQuery(query, PAGE_SIZE);
  // Each stays live only while it shows.
  const favorites = useContactRows({ scope: 'favorites' }, { isLive: segment === 'contacts' && !searchText.trim() });
  const lists = useContactListRows({ isLive: segment === 'lists' });

  const isContacts = segment === 'contacts';
  const isSearching = !!searchText.trim();
  const data = isContacts ? (rows ?? []) : [];

  function handleAdd() {
    if (isContacts) router.navigate('/new-contact');
    else promptAddList();
  }

  function renderItem({ item: contact, index }: ListRenderItemInfo<schema.ContactRow>) {
    return (
      <ContactRow
        contact={contact}
        trailing={<ContactRowMenu contact={contact} />}
        isFirst={index === 0}
        isLast={index === data.length - 1}
      />
    );
  }

  const header = (
    <View>
      {isContacts ? (
        <>
          {!isSearching && !!favorites?.length && (
            <>
              <ScreenSectionHeader title="Favorites" size="small" isFirst />
              <ContactAvatarRow contacts={favorites} />
            </>
          )}
          {!!count && (
            <ScreenSectionHeader
              title={pluralizeText('1 contact', `${count.toLocaleString()} contacts`, count)}
              size="small"
              isFirst={isSearching || !favorites?.length}
            />
          )}
          {count === 0 && (
            <EmptyState
              icon={isSearching ? 'search' : 'contacts'}
              title={isSearching ? 'No contacts match' : 'No contacts yet'}
              subtitle={isSearching ? undefined : 'Tap + to add the people you work with.'}
            />
          )}
        </>
      ) : (
        lists &&
        (lists.length > 0 ? (
          <>
            <ScreenSectionHeader title={pluralizeText('1 list', '%{count} lists', lists.length)} size="small" isFirst />
            <ContactListRows lists={lists} />
          </>
        ) : (
          <EmptyState icon="list" title="No lists yet" subtitle="Tap + to make one." />
        ))
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader
        title={<SegmentedPill items={SEGMENTS} activeKey={segment} onSelect={setSegment} size="title" />}
        onAdd={handleAdd}
      />
      <Animated.FlatList
        // The list fills the ref; useListControls only calls its scrollToOffset.
        ref={listRef as RefObject<FlatList<schema.ContactRow> | null>}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        onEndReached={rows ? loadMore : undefined}
        onEndReachedThreshold={2}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        style={styles.list}
      />
      {isContacts && (
        <FloatingActionsBar
          search={searchBar}
          placeholder="Search contacts…"
          sortOrder={sortOrder}
          sortOptions={contactSortOptions}
          onSort={sort}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.sideGutter,
  },
});
