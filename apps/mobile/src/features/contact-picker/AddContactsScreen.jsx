import { useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import readAddContactsSeed from './readAddContactsSeed';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SearchInput from '@/components/SearchInput';
import SelectIndicator from '@/components/SelectIndicator';
import { SCREEN_PADDING } from '@/constants';
import ContactRow from '@/features/contact-list/ContactRow';
import contactQuery from '@/features/contact-list/contactQuery';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { useLiveQuery } from '@/sync/useLiveQuery';
import toggleItem from '@/utils/toggleItem';

/**
 * The contacts of a photo, album or post (`?targetType=&targetId=`) or of a list (`?listId=`), to
 * pick: the ones it has now (picked), the ones on what it is part of or holds, then everyone else,
 * with a search. Save makes the picked ones its contacts, so taking one out here removes it.
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
  const { setTargetContacts, setListContacts } = useContacts();
  const [selectedIds, setSelectedIds] = useState(seed.linked);
  const [typedText, setTypedText] = useState('');
  const searchText = useDeferredValue(typedText);
  const contacts = useAllContacts(searchText);
  const isDirty = JSON.stringify([...selectedIds].sort()) !== JSON.stringify([...seed.linked].sort());
  const { sheetProps } = useEditSheet({ isDirty, save, syncsItself: true });

  const sections = contacts ? toSections(contacts, seed) : [];

  function save() {
    return target.listId ? setListContacts(target.listId, selectedIds) : setTargetContacts(target, selectedIds);
  }

  function renderItem({ item: contact, index, section }) {
    const isSelected = selectedIds.includes(contact.id);
    return (
      <View style={styles.gutter}>
        <ContactRow
          contact={contact}
          trailing={<SelectIndicator isSelected={isSelected} style={styles.indicator} />}
          onPress={() => setSelectedIds((current) => toggleItem(current, contact.id))}
          isSelected={isSelected}
          isFirst={index === 0}
          isLast={index === section.data.length - 1}
        />
      </View>
    );
  }

  return (
    <ModalSheet>
      <ModalHeader
        leading={
          <Button
            icon="close"
            accessibilityLabel="Close"
            onPress={sheetProps.onCancel}
            disabled={sheetProps.isSaving}
          />
        }
        title="Add contacts"
        subtitle={seed.title}
        trailing={
          <Button
            variant="primary"
            label="Save"
            onPress={sheetProps.onConfirm}
            disabled={!sheetProps.canConfirm || sheetProps.isSaving}
            loading={sheetProps.isSaving}
          />
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(contact) => contact.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.gutter}>
            <ScreenSectionHeader title={section.title} />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <SearchInput
            variant="field"
            placeholder="Search contacts"
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

function useAllContacts(search) {
  const query = contactQuery({ scope: 'all', search });
  return useLiveQuery(async (db) => (await query.read(db)).rows, query.tables, [query.descriptor]);
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
  indicator: {
    marginRight: 12,
  },
});
