import { useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import readAddContactsSeed from './readAddContactsSeed';

import EditSheetHeader from '@/components/EditSheetHeader';
import EmptyState from '@/components/EmptyState';
import { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SearchInput from '@/components/SearchInput';
import { SCREEN_PADDING } from '@/constants';
import ContactRow from '@/features/contact-list/ContactRow';
import contactPlace from '@/features/contact-list/contactPlace';
import contactSearchText from '@/features/contact-list/contactSearchText';
import useContactRows from '@/features/contact-list/useContactRows';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { matchingIds } from '@/sync/matchingIds';
import toggleItem from '@/utils/toggleItem';

/**
 * The contacts of a photo, album or post (`?targetType=&targetId=`) or of a list (`?listId=`), to
 * pick: the ones it has now (picked), the ones on what it is part of or holds, then everyone else,
 * with a search. Save adds the ones picked here and removes the ones unpicked here.
 */
export default function AddContactsScreen() {
  const params = useLocalSearchParams();
  const target = params.listId
    ? { listId: params.listId }
    : { targetType: params.targetType, targetId: params.targetId };
  const seed = useSeedOrClose((db) => readAddContactsSeed(db, target), JSON.stringify(target), 'It was deleted');
  if (!seed) return null;
  return <AddContactsPicker target={target} seed={seed} />;
}

function AddContactsPicker({ target, seed }) {
  const { bottom } = useSafeAreaInsets();
  const { changeTargetContacts, changeListContacts } = useContacts();
  const [selectedIds, setSelectedIds] = useState(seed.linked);
  const [typedText, setTypedText] = useState('');
  const searchText = useDeferredValue(typedText).trim().toLowerCase();
  // Every contact, read once (and on writes); a search filters them here, so typing reads nothing.
  const allContacts = useContactRows({ scope: 'all' });
  const contacts = useMemo(() => {
    if (!allContacts || !searchText) return allContacts;
    const matched = new Set(
      matchingIds(
        allContacts.map((contact) => ({ id: contact.id, text: contactSearchText(contact) })),
        searchText,
      ),
    );
    return allContacts.filter((contact) => matched.has(contact.id));
  }, [allContacts, searchText]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const linked = useMemo(() => new Set(seed.linked), [seed.linked]);
  const sections = useMemo(() => (contacts ? toSections(contacts, seed) : []), [contacts, seed]);

  const isDirty = selected.size !== linked.size || selectedIds.some((id) => !linked.has(id));
  const { sheetProps } = useEditSheet({ isDirty, save, syncsItself: true });

  // Writes only what was picked or unpicked here, so a contact another device added or removed
  // while the sheet was open keeps that change.
  function save() {
    const change = {
      added: selectedIds.filter((id) => !linked.has(id)),
      removed: seed.linked.filter((id) => !selected.has(id)),
    };
    return target.listId ? changeListContacts(target.listId, change) : changeTargetContacts(target, change);
  }

  function renderItem({ item: contact, index, section }) {
    const isSelected = selected.has(contact.id);
    return (
      <View style={styles.gutter}>
        <ContactRow
          contact={contact}
          onPress={() => setSelectedIds((current) => toggleItem(current, contact.id))}
          isSelected={isSelected}
          subtitle={contactPlace(contact)}
          isFirst={index === 0}
          isLast={index === section.data.length - 1}
        />
      </View>
    );
  }

  return (
    <ModalSheet>
      <EditSheetHeader {...sheetProps} title="Add contacts" subtitle={seed.title} />
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
          <SearchInput
            variant="field"
            placeholder="Name, handle or place"
            accessibilityLabel="Search contacts"
            value={typedText}
            onChangeText={setTypedText}
            clearButtonMode="while-editing"
            style={styles.search}
          />
        }
        ListEmptyComponent={contacts && <EmptyState icon="search" title="No contacts match" />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + SCREEN_PADDING }}
      />
    </ModalSheet>
  );
}

// The contacts in the seed's sections, each once, where it first fits; everyone else after them.
function toSections(contacts, seed) {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const placed = new Set();
  const sections = [];
  for (const { title, ids } of [{ title: seed.linkedTitle, ids: seed.linked }, ...seed.related]) {
    const data = ids.filter((id) => byId.has(id) && !placed.has(id)).map((id) => byId.get(id));
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
  search: {
    marginHorizontal: SCREEN_PADDING,
  },
});
