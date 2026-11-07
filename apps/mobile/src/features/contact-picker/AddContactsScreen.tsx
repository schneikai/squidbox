import { CONTACT_LINK_TARGETS, type ContactLinkRecord } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { SectionList, type SectionListRenderItemInfo, StyleSheet, View } from 'react-native';

import readAddContactsSeed, { type AddContactsSeed, type AddContactsTarget } from './readAddContactsSeed';

import EditSheetHeader from '@/components/EditSheetHeader';
import EmptyState from '@/components/EmptyState';
import MenuButton from '@/components/MenuButton';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SearchInput from '@/components/SearchInput';
import SortFilterMenu from '@/components/floating-bars/SortFilterMenu';
import { SCREEN_PADDING } from '@/constants';
import ContactRow from '@/features/contact-list/ContactRow';
import type { ContactSummary } from '@/features/contact-list/contactQuery';
import contactSearchText from '@/features/contact-list/contactSearchText';
import contactSortOptions from '@/features/contact-list/contactSortOptions';
import useContactRows from '@/features/contact-list/useContactRows';
import useContactSort from '@/features/contact-list/useContactSort';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { layout } from '@/styles/designTokens';
import { matchingIds } from '@/sync/matchingIds';
import confirmAsync from '@/utils/confirmAsync';
import pluralizeText from '@/utils/pluralizeText';
import toggleItem from '@/utils/toggleItem';

type ContactSectionData = { title: string; data: ContactSummary[] };

const isTargetType = (type: string | undefined): type is ContactLinkRecord['targetType'] =>
  CONTACT_LINK_TARGETS.some((target) => target === type);

/**
 * The contacts of a photo, album or post (`?targetType=&targetId=`) or of a list (`?listId=`), to
 * pick: the ones it has now (picked), the ones on what it is part of or holds, then everyone else,
 * with a search and the Contacts tab's sort beside it (useContactSort). Save adds the ones picked
 * here and removes the ones unpicked here. For every photo of an album (`?photosOfAlbumId=`) it is
 * the album's Contacts: the ones on any of its photos start picked, each with how many it is on;
 * Save puts the newly picked ones on every photo and, once confirmed, takes the unpicked ones off
 * all of them.
 */
export default function AddContactsScreen() {
  const params = useLocalSearchParams<{
    listId?: string;
    targetType?: string;
    targetId?: string;
    photosOfAlbumId?: string;
  }>();
  const target: AddContactsTarget | null = params.listId
    ? { listId: params.listId }
    : params.photosOfAlbumId
      ? { photosOfAlbumId: params.photosOfAlbumId }
      : isTargetType(params.targetType) && params.targetId
        ? { targetType: params.targetType, targetId: params.targetId }
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
  const padding = useScreenPadding('sheet');
  const { changeTargetContacts, changeListContacts, addContactsToAlbumPhotos, removeContactsFromPhotosOf } =
    useContacts();
  const [selectedIds, setSelectedIds] = useState(seed.linked);
  const [typedText, setTypedText] = useState('');
  const searchText = useDeferredValue(typedText).trim().toLowerCase();
  const { sortOrder, setSortOrder } = useContactSort();
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
  const linked = useMemo(() => new Set(seed.linked), [seed.linked]);
  const sections = useMemo(() => (contacts ? toSections(contacts, seed) : []), [contacts, seed]);

  const isDirty = selected.size !== linked.size || selectedIds.some((id) => !linked.has(id));
  const { sheetProps } = useEditSheet({ isDirty, save, syncsItself: true });

  // Writes only what was picked or unpicked here, so a contact another device added or removed
  // while the sheet was open keeps that change.
  async function save() {
    const change = {
      added: selectedIds.filter((id) => !linked.has(id)),
      removed: seed.linked.filter((id) => !selected.has(id)),
    };
    if ('photosOfAlbumId' in target) return saveToAlbumPhotos(target.photosOfAlbumId, change);
    return 'listId' in target ? changeListContacts(target.listId, change) : changeTargetContacts(target, change);
  }

  async function saveToAlbumPhotos(albumId: string, { added, removed }: { added: string[]; removed: string[] }) {
    if (removed.length) {
      const names = removed.map((id) => allContacts?.find((contact) => contact.id === id)?.name ?? 'A contact');
      const isConfirmed = await confirmAsync({
        title: names.length === 1 ? `Remove ${names[0]}?` : `Remove ${names.length} contacts?`,
        message: `${names.join(', ')} ${names.length === 1 ? 'comes' : 'come'} off every photo in this album.`,
        action: 'Remove',
        destructive: true,
      });
      // An empty refusal keeps the sheet open as it is.
      if (!isConfirmed) return { refused: '' };
      await removeContactsFromPhotosOf({ targetType: 'album', targetId: albumId }, removed);
    }
    if (added.length) await addContactsToAlbumPhotos(albumId, added);
    return undefined;
  }

  const handleToggle = useCallback(
    (contactId: string) => setSelectedIds((current) => toggleItem(current, contactId)),
    [],
  );
  // Stable while the picks are; a pick re-renders only the rows it changes (PickRow is memo).
  const renderItem = useCallback(
    ({ item: contact, index, section }: SectionListRenderItemInfo<ContactSummary, ContactSectionData>) => (
      <PickRow
        contact={contact}
        isSelected={selected.has(contact.id)}
        detail={photoDetail(seed, contact.id)}
        onToggle={handleToggle}
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
      />
    ),
    [selected, handleToggle, seed],
  );

  return (
    <ModalSheet>
      <EditSheetHeader {...sheetProps} title={seed.photos ? 'Contacts' : 'Add contacts'} subtitle={seed.title} />
      <SectionList
        sections={sections}
        keyExtractor={(contact) => contact.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.gutter}>
            <ScreenSectionHeader title={section.title} size="small" />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.controls}>
            <SearchInput
              variant="field"
              placeholder="Name, handle or location"
              accessibilityLabel="Search contacts"
              value={typedText}
              onChangeText={setTypedText}
              clearButtonMode="while-editing"
              style={styles.search}
            />
            <MenuButton icon="options" accessibilityLabel="Sort contacts">
              <SortFilterMenu sortOrder={sortOrder} sortOptions={contactSortOptions} onSort={setSortOrder} />
            </MenuButton>
          </View>
        }
        ListEmptyComponent={contacts ? <EmptyState icon="search" title="No contacts match" /> : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={padding}
      />
    </ModalSheet>
  );
}

type PickRowProps = {
  contact: ContactSummary;
  isSelected: boolean;
  onToggle: (contactId: string) => void;
  isFirst: boolean;
  isLast: boolean;
  detail?: string;
};

// A contact to pick, with its place under its name (ContactRow's), or `detail`.
const PickRow = memo(function PickRow({ contact, isSelected, onToggle, isFirst, isLast, detail }: PickRowProps) {
  return (
    <View style={styles.gutter}>
      <ContactRow
        contact={contact}
        onPress={() => onToggle(contact.id)}
        isSelected={isSelected}
        isFirst={isFirst}
        isLast={isLast}
        detail={detail}
      />
    </View>
  );
});

// "On 2 of 29 photos" for a contact on an album's photos: "On all 29 photos" when on each of them.
function photoDetail({ photos }: AddContactsSeed, contactId: string): string | undefined {
  const count = photos?.counts.get(contactId);
  if (!photos || count === undefined) return undefined;
  if (count === photos.total) return pluralizeText('On its photo', 'On all %{count} photos', count);
  return `On ${count.toLocaleString()} of ${photos.total.toLocaleString()} photos`;
}

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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    marginHorizontal: SCREEN_PADDING,
  },
  search: {
    flex: 1,
  },
});
