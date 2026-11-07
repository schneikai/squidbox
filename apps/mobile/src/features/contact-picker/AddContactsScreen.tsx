import { CONTACT_LINK_TARGETS, type ContactLinkRecord } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { SectionList, type SectionListRenderItemInfo, StyleSheet, View } from 'react-native';

import readAddContactsSeed, { type AddContactsSeed, type AddContactsTarget } from './readAddContactsSeed';

import EditSheetHeader from '@/components/EditSheetHeader';
import EmptyState from '@/components/EmptyState';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SearchInput from '@/components/SearchInput';
import { SCREEN_PADDING } from '@/constants';
import ContactRow from '@/features/contact-list/ContactRow';
import type { ContactSummary } from '@/features/contact-list/contactQuery';
import contactSearchText from '@/features/contact-list/contactSearchText';
import useContactRows from '@/features/contact-list/useContactRows';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { matchingIds } from '@/sync/matchingIds';
import toggleItem from '@/utils/toggleItem';

type ContactSectionData = { title: string; data: ContactSummary[] };

const isTargetType = (type: string | undefined): type is ContactLinkRecord['targetType'] =>
  CONTACT_LINK_TARGETS.some((target) => target === type);

/**
 * The contacts of a photo, album or post (`?targetType=&targetId=`) or of a list (`?listId=`), to
 * pick: the ones it has now (picked), the ones on what it is part of or holds, then everyone else,
 * with a search. Save adds the ones picked here and removes the ones unpicked here.
 */
export default function AddContactsScreen() {
  const params = useLocalSearchParams<{ listId?: string; targetType?: string; targetId?: string }>();
  const target: AddContactsTarget | null = params.listId
    ? { listId: params.listId }
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
  const { changeTargetContacts, changeListContacts } = useContacts();
  const [selectedIds, setSelectedIds] = useState(seed.linked);
  const [typedText, setTypedText] = useState('');
  const searchText = useDeferredValue(typedText).trim().toLowerCase();
  // Every contact, read once (and on writes); a search filters them here, so typing reads nothing.
  const allContacts = useContactRows({ scope: 'all' });
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
  function save() {
    const change = {
      added: selectedIds.filter((id) => !linked.has(id)),
      removed: seed.linked.filter((id) => !selected.has(id)),
    };
    return 'listId' in target ? changeListContacts(target.listId, change) : changeTargetContacts(target, change);
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
        onToggle={handleToggle}
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
      />
    ),
    [selected, handleToggle],
  );

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
            placeholder="Name, handle or location"
            accessibilityLabel="Search contacts"
            value={typedText}
            onChangeText={setTypedText}
            clearButtonMode="while-editing"
            style={styles.search}
          />
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

// The contacts in the seed's sections, each once, where it first fits; everyone else after them.
function toSections(contacts: ContactSummary[], seed: AddContactsSeed): ContactSectionData[] {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const placed = new Set<string>();
  const sections: ContactSectionData[] = [];
  for (const { title, ids } of [{ title: seed.linkedTitle, ids: seed.linked }, ...seed.related]) {
    const data = ids
      .filter((id) => !placed.has(id))
      .map((id) => byId.get(id))
      .filter((contact): contact is ContactSummary => !!contact);
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
