import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { type ListRenderItemInfo, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactAvatarRow from './ContactAvatarRow';
import ContactListRows from './ContactListRows';
import ContactRow from './ContactRow';
import ContactRowMenu from './ContactRowMenu';
import contactQuery, { type ContactSummary } from './contactQuery';
import contactSortOptions from './contactSortOptions';
import pinnedList from './pinnedList';
import shownContactLists from './shownContactLists';
import useAddListAction from './useAddListAction';
import useBuiltInContactListRows from './useBuiltInContactListRows';
import useContactListRows from './useContactListRows';
import useContactListSort from './useContactListSort';
import useContactRows from './useContactRows';
import useContactSort from './useContactSort';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import IntroText from '@/components/IntroText';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import SegmentedPill, { type SegmentedPillItem } from '@/components/floating-bars/SegmentedPill';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

type Segment = 'contacts' | 'lists';

const SEGMENTS: SegmentedPillItem<Segment>[] = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'lists', label: 'Lists' },
];
const PAGE_SIZE = 100;
const keyExtractor = (contact: ContactSummary) => contact.id;

// The Contacts tab: the contacts (favorites first as a row of avatars, or the list the pen pinned in their place, then everyone, by name or recently added) or
// the contact lists (the built-in ones, Favorites, Tagged and Deleted, among the user's), switched with the Contacts | Lists pill that is the header's title.
// Each has its own sort in the one search and sort bar, which searches the one showing. + adds a contact, or a list.
export default function ContactsScreen() {
  const [segment, setSegment] = useState<Segment>('contacts');
  const { paddingTop, paddingBottom } = useScreenPadding('main');
  const { sortOrder: contactSortOrder, sortContacts } = useContactSort();
  const { sortOrder: listSortOrder, sortLists } = useContactListSort();
  const isContacts = segment === 'contacts';
  const sortOrder = isContacts ? contactSortOrder : listSortOrder;
  const { listRef, sort, searchBar, searchText } = useListControls({ onSort: isContacts ? sortContacts : sortLists });
  const attachList = useListRefCallback(listRef);
  const scrollHandler = useFloatingBarScrollHandler();
  const promptAddList = useAddListAction();

  const isSearching = !!searchText.trim();
  // Trimmed, so a trailing space doesn't read the list again.
  const query = contactQuery({ scope: 'all', search: searchText.trim(), sort: contactSortOrder, withLists: true });
  // Each stays live only while it shows.
  const { rows, count, loadMore } = usePagedQuery(query, PAGE_SIZE, { isLive: isContacts });
  const lists = useContactListRows({ isLive: segment === 'lists' });
  const builtInLists = useBuiltInContactListRows({ isLive: segment === 'lists' });
  // The lists (the pen shows once there are some), and the one pinned in place of Favorites.
  const pinOptions = useContactListRows({ withMembers: false, isLive: isContacts && !isSearching });
  const pinned = pinnedList(pinOptions);
  const pinnedContacts = useContactRows(pinned ? { scope: { listId: pinned.id } } : { scope: 'favorites' }, {
    isLive: isContacts && !isSearching,
  });
  // Favorites shows once there are some; a pinned list even while it is empty, so the pen can change it.
  const hasPinned = !isSearching && (!!pinnedContacts?.length || (!!pinned && !!pinnedContacts));
  const shownLists = useMemo(
    () => lists && builtInLists && shownContactLists([...builtInLists, ...lists], searchText, listSortOrder),
    [lists, builtInLists, searchText, listSortOrder],
  );

  const data = isContacts ? (rows ?? []) : [];
  const lastIndex = data.length - 1;
  // Stable while the rows' count is, so a keystroke doesn't re-render every row (ContactRow is memo).
  const renderItem = useCallback(
    ({ item: contact, index }: ListRenderItemInfo<ContactSummary>) => (
      <ContactRowMenu
        contact={contact}
        trigger={({ toggle }) => (
          <ContactRow contact={contact} onLongPress={toggle} isFirst={index === 0} isLast={index === lastIndex} />
        )}
      />
    ),
    [lastIndex],
  );

  function handleAdd() {
    if (isContacts) router.navigate('/new-contact');
    else promptAddList();
  }

  const header = (
    <View>
      {isContacts ? (
        <>
          {hasPinned && (
            <>
              <ScreenSectionHeader
                title={pinned?.name ?? 'Favorites'}
                size="small"
                isFirst
                trailing={
                  !!pinOptions?.length && (
                    <Button
                      icon="edit"
                      size="small"
                      accessibilityLabel="Choose what to pin"
                      onPress={() => router.navigate('/pin-contact-list')}
                    />
                  )
                }
              />
              {pinnedContacts?.length ? (
                <ContactAvatarRow contacts={pinnedContacts} />
              ) : (
                <IntroText isScreenIntro>No contacts in this list yet.</IntroText>
              )}
            </>
          )}
          {!!count && (
            <ScreenSectionHeader
              title={pluralizeText('1 contact', `${count.toLocaleString()} contacts`, count)}
              size="small"
              isFirst={!hasPinned}
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
        shownLists &&
        (shownLists.length > 0 ? (
          <>
            <ScreenSectionHeader
              title={pluralizeText('1 list', '%{count} lists', shownLists.length)}
              size="small"
              isFirst
            />
            <ContactListRows lists={shownLists} />
          </>
        ) : (
          <EmptyState icon="search" title="No lists match" />
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
        ref={attachList}
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
      <FloatingActionsBar
        search={searchBar}
        placeholder={isContacts ? 'Search contacts…' : 'Search lists…'}
        sortOrder={sortOrder}
        sortOptions={contactSortOptions}
        onSort={sort}
      />
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
