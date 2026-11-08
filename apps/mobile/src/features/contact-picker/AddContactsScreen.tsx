import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { SectionList, type SectionListRenderItemInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import readAddContactsSeed, { type AddContactsSeed, type AddContactsTarget } from './readAddContactsSeed';

import EditSheetHeader from '@/components/EditSheetHeader';
import EmptyState from '@/components/EmptyState';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import { SCREEN_PADDING } from '@/constants';
import confirmRemoveFromPhotos from '@/features/contact-links/confirmRemoveFromPhotos';
import { contactsOfName } from '@/features/contact-links/contactsOf';
import ContactRow from '@/features/contact-list/ContactRow';
import type { ContactSummary } from '@/features/contact-list/contactQuery';
import contactSearchText from '@/features/contact-list/contactSearchText';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import useContactRows from '@/features/contact-list/useContactRows';
import useContactSort from '@/features/contact-list/useContactSort';
import type { MembershipChange } from '@/features/contacts-context/ContactsContext';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useListControls from '@/hooks/useListControls';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { layout } from '@/styles/designTokens';
import type { PhotosOf } from '@/sync/assetSql';
import { matchingIds } from '@/sync/matchingIds';
import toggleItem from '@/utils/toggleItem';

type ContactSectionData = { title: string; data: ContactSummary[] };

/**
 * The contacts of a photo (`?assetId=`) or of a list (`?listId=`), to pick: the ones it has now
 * (picked), the ones on the photos of the albums it is in, then everyone else, with search and the
 * Contacts tab's sort (useContactSort) in the floating bar at the bottom left. Save adds the ones
 * picked here and removes the ones unpicked here. For an album's or post's photos (`?albumId=`,
 * `?postId=`) it is its Contacts: the ones on all its photos start ticked, those on some with a
 * dash; Save puts the ticked ones on every photo and, once confirmed, takes the emptied ones off all
 * of them.
 */
export default function AddContactsScreen() {
  const params = useLocalSearchParams<{ listId?: string; assetId?: string; albumId?: string; postId?: string }>();
  const target: AddContactsTarget | null = params.listId
    ? { listId: params.listId }
    : params.assetId
      ? { assetId: params.assetId }
      : params.albumId
        ? { albumId: params.albumId }
        : params.postId
          ? { postId: params.postId }
          : null;
  // A link to a target this app doesn't know closes the sheet, as a deleted one does.
  const seed = useSeedOrClose(
    async (db) => (target ? readAddContactsSeed(db, target) : null),
    JSON.stringify(target),
    'It was deleted',
  );
  if (!seed || !target) return null;
  return <AddContactsPicker target={target} seed={seed} />;
}

type AddContactsPickerProps = { target: AddContactsTarget; seed: AddContactsSeed };

function AddContactsPicker({ target, seed }: AddContactsPickerProps) {
  const { bottom } = useSafeAreaInsets();
  const { changePhotoContacts, changeListContacts, changeContactsOnPhotosOf } = useContacts();
  // The ones on only some of an album's photos start with a dash (`mixed`), the rest of `linked` ticked.
  const partial = useMemo(() => new Set(seed.partial), [seed.partial]);
  const initialIds = useMemo(() => seed.linked.filter((id) => !partial.has(id)), [seed.linked, partial]);
  // One state, so a pick's toggle reads the latest picks and stays the same function.
  const [{ selectedIds, mixedIds }, setPicks] = useState({ selectedIds: initialIds, mixedIds: seed.partial ?? [] });
  const { sortOrder, setSortOrder } = useContactSort();
  const { listRef, sort, searchBar, searchText: typedSearch } = useListControls({ onSort: setSortOrder });
  const searchText = typedSearch.trim().toLowerCase();
  // A SectionList scrolls to an offset through its scroll responder.
  const attachList = useCallback(
    (list: SectionList<ContactSummary, ContactSectionData> | null) => {
      listRef.current = list && {
        scrollToOffset: ({ animated, offset }) => list.getScrollResponder()?.scrollTo({ y: offset, animated }),
      };
    },
    [listRef],
  );
  // Every contact, read once (and on writes and a new sort); a search filters them here, so typing
  // reads nothing.
  const allContacts = useContactRows({ scope: 'all', sort: sortOrder });
  // Each contact's searched text, made once per read rather than per keystroke.
  const searchList = useMemo(
    () => allContacts?.map((contact) => ({ id: contact.id, text: contactSearchText(contact) })),
    [allContacts],
  );
  const contacts = useMemo(() => {
    if (!allContacts || !searchList || !searchText) return allContacts;
    const matched = new Set(matchingIds(searchList, searchText));
    return allContacts.filter((contact) => matched.has(contact.id));
  }, [allContacts, searchList, searchText]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const mixed = useMemo(() => new Set(mixedIds), [mixedIds]);
  const linked = useMemo(() => new Set(initialIds), [initialIds]);
  const sections = useMemo(() => (contacts ? toSections(contacts, seed) : []), [contacts, seed]);

  const isDirty =
    selected.size !== linked.size || selectedIds.some((id) => !linked.has(id)) || mixed.size !== partial.size;
  const { sheetProps } = useEditSheet({ isDirty, save, syncsItself: true });

  // Writes only what was picked or unpicked here, so a contact another device added or removed
  // while the sheet was open keeps that change.
  async function save() {
    const change = {
      added: selectedIds.filter((id) => !linked.has(id)),
      removed: seed.linked.filter((id) => !selected.has(id) && !mixed.has(id)),
    };
    if ('listId' in target) return changeListContacts(target.listId, change);
    if ('assetId' in target) return changePhotoContacts(target.assetId, change);
    return saveToPhotosOf(target, change);
  }

  async function saveToPhotosOf(of: PhotosOf, change: MembershipChange) {
    if (change.removed.length) {
      const byId = new Map(allContacts?.map((contact) => [contact.id, contact.name]));
      const names = change.removed.map((id) => byId.get(id) ?? 'A contact');
      // An empty refusal keeps the sheet open as it is.
      if (!(await confirmRemoveFromPhotos(names, contactsOfName(of)))) return { refused: '' };
    }
    await changeContactsOnPhotosOf(of, change);
    return undefined;
  }

  // A tick goes, an empty circle ticks; one on some of the photos goes dash → tick → empty → dash.
  const handleToggle = useCallback(
    (contactId: string) =>
      setPicks((picks) => {
        if (picks.mixedIds.includes(contactId)) {
          return {
            selectedIds: toggleItem(picks.selectedIds, contactId),
            mixedIds: picks.mixedIds.filter((id) => id !== contactId),
          };
        }
        if (!picks.selectedIds.includes(contactId) && partial.has(contactId)) {
          return { ...picks, mixedIds: [...picks.mixedIds, contactId] };
        }
        return { ...picks, selectedIds: toggleItem(picks.selectedIds, contactId) };
      }),
    [partial],
  );
  // Stable while the picks are; a pick re-renders only the rows it changes (PickRow is memo).
  const renderItem = useCallback(
    ({ item: contact, index, section }: SectionListRenderItemInfo<ContactSummary, ContactSectionData>) => (
      <PickRow
        contact={contact}
        isSelected={mixed.has(contact.id) ? 'mixed' : selected.has(contact.id)}
        onToggle={handleToggle}
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
      />
    ),
    [selected, mixed, handleToggle],
  );

  return (
    <ModalSheet>
      <EditSheetHeader {...sheetProps} title="Add contacts" subtitle={seed.subtitle} />
      <SectionList
        ref={attachList}
        sections={sections}
        keyExtractor={(contact) => contact.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.gutter}>
            <ScreenSectionHeader title={section.title} size="small" />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={contacts ? <EmptyState icon="search" title="No contacts match" /> : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: layout.sheetContentTop, paddingBottom: bottom + layout.barClearance }}
      />
      <SearchSortFilterBar
        search={searchBar}
        placeholder="Name, handle or location"
        sortOrder={sortOrder}
        sortOptions={contactSortOptions}
        onSort={sort}
      />
    </ModalSheet>
  );
}

type PickRowProps = {
  contact: ContactSummary;
  isSelected: boolean | 'mixed';
  onToggle: (contactId: string) => void;
  isFirst: boolean;
  isLast: boolean;
};

// A contact to pick, with its place under its name (ContactRow's).
const PickRow = memo(function PickRow({ contact, isSelected, onToggle, isFirst, isLast }: PickRowProps) {
  return (
    <View style={styles.gutter}>
      <ContactRow
        contact={contact}
        onPress={() => onToggle(contact.id)}
        isSelected={isSelected}
        isFirst={isFirst}
        isLast={isLast}
      />
    </View>
  );
});

// The contacts in the seed's sections, each once, where it first fits, in the contacts' sort;
// everyone else after them.
function toSections(contacts: ContactSummary[], seed: AddContactsSeed): ContactSectionData[] {
  const placed = new Set<string>();
  const sections: ContactSectionData[] = [];
  for (const { title, ids } of [{ title: seed.linkedTitle, ids: seed.linked }, ...seed.related]) {
    const inSection = new Set(ids);
    const data = contacts.filter((contact) => inSection.has(contact.id) && !placed.has(contact.id));
    for (const contact of data) placed.add(contact.id);
    if (data.length) sections.push({ title, data });
  }
  const rest = contacts.filter((contact) => !placed.has(contact.id));
  if (rest.length) sections.push({ title: 'All contacts', data: rest });
  return sections;
}

const styles = StyleSheet.create({
  gutter: {
    paddingHorizontal: SCREEN_PADDING,
  },
});
