import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { type ListRenderItemInfo, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import ContactAvatarRow from './ContactAvatarRow';
import ContactMenuRow from './ContactMenuRow';
import { builtInContactList } from './builtInContactLists';
import contactQuery, { type ContactSummary } from './contactQuery';
import contactSortOptions from './contactSortOptions';
import useContactSort from './useContactSort';
import usePinnedContactList from './usePinnedContactList';

import EmptyState from '@/components/EmptyState';
import IntroText from '@/components/IntroText';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useListControls from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScreenPadding from '@/hooks/useScreenPadding';
import useScrollY from '@/hooks/useScrollY';
import { layout } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const PAGE_SIZE = 100;
const PINNED_PAGE_SIZE = 30;
const keyExtractor = (contact: ContactSummary) => contact.id;

// The Contacts tab: favorites first as a row of avatars (or the list pinned in their place: tapping the row's name picks it),
// then everyone, by name or recently added, searched and sorted in the floating bar. All lists, at the end of the
// pinned row's header, pushes the contact lists (ContactListsScreen). + adds a contact.
export default function ContactsScreen() {
  const { paddingTop, paddingBottom } = useScreenPadding('main');
  const { sortOrder, setSortOrder } = useContactSort('contacts');
  const { listRef, sort, searchBar, searchText: search } = useListControls({ onSort: setSortOrder });
  const attachList = useListRefCallback(listRef);
  const { onScroll, scrollY } = useScrollY();

  // Trimmed, so a trailing space doesn't read the list again.
  const isSearching = !!search;
  const query = contactQuery({ scope: 'all', search, sort: sortOrder, withLists: true });
  const { rows, count, loadMore } = usePagedQuery(query, PAGE_SIZE);
  // What is pinned in place of Favorites, and whether there is anything else to pin (the name's tap).
  const pin = usePinnedContactList({ isLive: !isSearching });
  const pinned = pin.pinned ?? null;
  const canChangePin = pin.canPinBuiltIn || !!pin.lists?.length;
  // Paged as the row scrolls: Tagged can hold nearly everyone.
  const {
    rows: pinnedContacts,
    isCurrent: isPinnedCurrent,
    loadMore: loadMorePinned,
  } = usePagedQuery(contactQuery({ scope: pinned?.scope ?? 'favorites' }), PINNED_PAGE_SIZE, { isLive: !isSearching });
  // The tab first shows once the pin and its contacts are read too, so the pinned row doesn't land a moment
  // after the list and push it down. From then on it stays: a new pin or search keeps the last rows until its own land.
  const [isShown, setIsShown] = useState(false);
  if (!isShown && rows && pin.pinned !== undefined && isPinnedCurrent) setIsShown(true);
  // The pinned row's header (its name, All lists) heads the tab whenever it isn't searching; the row under it once there
  // are contacts, even while it is empty, so its name can change it.
  const hasPinnedHeader = isShown && !isSearching && !!pinnedContacts;
  const hasPinned = hasPinnedHeader && (pinnedContacts.length > 0 || !!pinned || !!count);
  const emptyTitle = builtInContactList(pinned?.id ?? 'favorites')?.emptyTitle ?? 'No contacts in this list yet';
  const pinnedEmptyText = pinned ? `${emptyTitle}.` : `${emptyTitle}. Double-tap a contact's photo to add one.`;

  const data = (isShown && rows) || [];
  const lastIndex = data.length - 1;
  // Stable while the rows' count is, so a keystroke doesn't re-render every row (ContactRow is memo).
  const renderItem = useCallback(
    ({ item: contact, index }: ListRenderItemInfo<ContactSummary>) => (
      <ContactMenuRow contact={contact} isFirst={index === 0} isLast={index === lastIndex} />
    ),
    [lastIndex],
  );

  const header = (
    <View>
      {hasPinnedHeader && (
        <ScreenSectionHeader
          title={pinned?.name ?? 'Favorites'}
          size="small"
          isFirst
          onTitlePress={canChangePin ? () => router.navigate('/pin-contact-list') : undefined}
          titleHint="Choose what to pin"
          link={{ label: 'All lists', onPress: () => router.navigate('/contact-lists') }}
        />
      )}
      {hasPinned &&
        (pinnedContacts?.length ? (
          <ContactAvatarRow contacts={pinnedContacts} loadMore={loadMorePinned} />
        ) : (
          <IntroText isScreenIntro>{pinnedEmptyText}</IntroText>
        ))}
      {isShown && !!count && (
        <ScreenSectionHeader
          title={pluralizeText('1 contact', `${count.toLocaleString()} contacts`, count)}
          size="small"
          isFirst={!hasPinnedHeader}
        />
      )}
      {isShown && count === 0 && (
        <EmptyState
          icon={isSearching ? 'search' : 'contacts'}
          title={isSearching ? 'No contacts match' : 'No contacts yet'}
          subtitle={isSearching ? undefined : 'Tap + to add the people you work with.'}
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader title="Contacts" scrollY={scrollY} onAdd={() => router.navigate('/new-contact')} />
      <Animated.FlatList
        ref={attachList}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        onEndReached={rows ? loadMore : undefined}
        onEndReachedThreshold={2}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        style={styles.list}
      />
      <FloatingActionsBar
        search={searchBar}
        placeholder="Search contacts…"
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
