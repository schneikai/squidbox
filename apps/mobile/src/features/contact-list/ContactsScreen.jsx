import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactAvatarRow from './ContactAvatarRow';
import ContactListRows from './ContactListRows';
import ContactRow from './ContactRow';
import ContactRowMenu from './ContactRowMenu';
import contactQuery from './contactQuery';
import useAddListAction from './useAddListAction';
import useContactListRows from './useContactListRows';
import useContactRows from './useContactRows';

import EmptyState from '@/components/EmptyState';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import SegmentedPill from '@/components/floating-bars/SegmentedPill';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const SEGMENTS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'lists', label: 'Lists' },
];
const PAGE_SIZE = 100;
const keyExtractor = (contact) => contact.id;

// The Contacts tab: the contacts (favorites first as a row of avatars, then everyone by name) or
// the contact lists, switched with the pill under the title. + adds a contact, or a list.
export default function ContactsScreen() {
  const [segment, setSegment] = useState('contacts');
  const { paddingTop, paddingBottom } = useScreenPadding('main');
  const { listRef, searchBar, searchText } = useListControls();
  const scrollHandler = useFloatingBarScrollHandler();
  const promptAddList = useAddListAction();

  const query = contactQuery({ scope: 'all', search: searchText });
  const { rows, count, loadMore } = usePagedQuery(query, PAGE_SIZE);
  // Each stays live only while it shows.
  const favorites = useContactRows({ scope: 'favorites' }, { isLive: segment === 'contacts' && !searchText.trim() });
  const lists = useContactListRows({ isLive: segment === 'lists' });

  const isContacts = segment === 'contacts';
  const isSearching = !!searchText.trim();
  const data = isContacts ? rows : [];

  function handleAdd() {
    if (isContacts) router.navigate('/new-contact');
    else promptAddList();
  }

  function renderItem({ item: contact, index }) {
    return (
      <ContactRow
        contact={contact}
        trailing={<ContactRowMenu contact={contact} />}
        isFirst={index === 0}
        isLast={index === rows.length - 1}
      />
    );
  }

  const header = (
    <View>
      <View style={styles.pill}>
        <SegmentedPill items={SEGMENTS} activeKey={segment} onSelect={setSegment} />
      </View>
      {isContacts ? (
        <>
          {!isSearching && favorites?.length > 0 && (
            <>
              <ScreenSectionHeader title="Favorites" />
              <ContactAvatarRow contacts={favorites} />
            </>
          )}
          {count > 0 && (
            <ScreenSectionHeader title={pluralizeText('1 contact', `${count.toLocaleString()} contacts`, count)} />
          )}
          {count === 0 && (
            <EmptyState
              icon={isSearching ? 'search' : 'id-card'}
              title={isSearching ? 'No contacts match' : 'No contacts yet'}
              subtitle={isSearching ? undefined : 'Tap + to add the people you work with.'}
            />
          )}
        </>
      ) : (
        lists &&
        (lists.length > 0 ? (
          <>
            <ScreenSectionHeader title={pluralizeText('1 list', '%{count} lists', lists.length)} />
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
      <FloatingHeader title="Contacts" onAdd={handleAdd} />
      <Animated.FlatList
        ref={listRef}
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
      {isContacts && <FloatingActionsBar search={searchBar} placeholder="Search contacts…" />}
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
  pill: {
    flexDirection: 'row',
  },
});
