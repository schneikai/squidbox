import type { ContactHandleField, ContactRecord } from '@squidbox/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, StyleSheet } from 'react-native';

import DuplicatesCard from './DuplicatesCard';
import QuickAddBar from './QuickAddBar';
import findDuplicates from './findDuplicates';
import useNewContactDraft from './useNewContactDraft';

import EditSheet from '@/components/EditSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ContactAvatarPicker from '@/features/contact-detail/ContactAvatarPicker';
import HandleField from '@/features/contact-detail/HandleField';
import HandleFieldsCard from '@/features/contact-detail/HandleFieldsCard';
import ListsField from '@/features/contact-detail/ListsField';
import NotesField from '@/features/contact-detail/NotesField';
import PlacesField from '@/features/contact-detail/PlacesField';
import {
  type ContactDraft,
  type HandleFormField,
  contactDraft,
  storedContactFields,
} from '@/features/contact-detail/contactFields';
import useContactListRows from '@/features/contact-list/useContactListRows';
import useContactRows from '@/features/contact-list/useContactRows';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useHaptics from '@/hooks/useHaptics';
import { space } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

const EMPTY_DRAFT = contactDraft();
const EMPTY = JSON.stringify(storedContactFields(EMPTY_DRAFT));

// The New contact sheet: a photo, the name, handles and phone, a note, places, and the lists to put it in
// (a place and the lists are steps pushed inside the sheet). Contacts it may duplicate show above the form, their shared
// fields marked. Add saves it and opens it.
export default function NewContactScreen() {
  const haptics = useHaptics();
  const { addContact } = useContacts();
  const { draft, setField, avatarUri, setAvatarUri, listIds, setListIds, fill } = useNewContactDraft();
  const allContacts = useContactRows({ scope: 'all' });
  const lists = useContactListRows({ withMembers: false });
  // Rescanned only when the contacts or what the check reads change, not on every keystroke in the notes.
  const { name, xHandle, instagramHandle, blueskyHandle, onlyFansHandle, jffHandle } = draft;
  const { matches, sharedFields } = useMemo(() => {
    const typed: Pick<ContactDraft, 'name' | ContactHandleField> = {
      name,
      xHandle,
      instagramHandle,
      blueskyHandle,
      onlyFansHandle,
      jffHandle,
    };
    return findDuplicates(storedContactFields({ ...EMPTY_DRAFT, ...typed }), allContacts ?? []);
  }, [allContacts, name, xHandle, instagramHandle, blueskyHandle, onlyFansHandle, jffHandle]);
  const fields = storedContactFields(draft);
  const selectedLists = (lists ?? []).filter((list) => listIds.includes(list.id));
  const isDirty = JSON.stringify(fields) !== EMPTY || !!avatarUri || listIds.length > 0;
  const { sheetProps, finish, confirmDiscard } = useEditSheet({
    isNew: true,
    isValid: !!fields.name,
    isDirty,
    save,
    syncsItself: true,
  });

  async function save() {
    const { contact, avatarError } = await addContact(fields, { avatarUri, listIds });
    // The contact is added either way; a photo that couldn't be made is said, not lost silently.
    if (avatarError) {
      Alert.alert("Couldn't add the photo", apiErrorMessage(avatarError));
    }
    haptics.success();
    return () => router.replace(`/contact/${contact.id}`);
  }

  function fieldProps(field: HandleFormField | 'name') {
    return { isFilled: !!fill?.fields.includes(field), isDuplicate: sharedFields.has(field) };
  }

  // Opening a duplicate leaves the draft, after asking when it has changes.
  async function handleOpenDuplicate(contact: Pick<ContactRecord, 'id'>) {
    if (await confirmDiscard())
      finish(async () => () => router.replace(`/contact/${contact.id}`), "Couldn't open the contact");
  }

  return (
    <EditSheet {...sheetProps} title="New contact">
      <QuickAddBar />
      {matches.length > 0 && <DuplicatesCard matches={matches} onOpen={handleOpenDuplicate} />}

      <ContactAvatarPicker
        contact={{ name: draft.name }}
        uri={avatarUri}
        variant="form"
        onPick={setAvatarUri}
        style={styles.photo}
      />

      <HandleFieldsCard draft={draft} onChange={setField} fieldProps={fieldProps} isOpenable={false}>
        <HandleField
          field="name"
          label="Name"
          value={draft.name}
          onChangeText={(text) => setField('name', text)}
          placeholder="Name"
          {...fieldProps('name')}
        />
      </HandleFieldsCard>

      <ScreenSectionHeader title="Notes" />
      <NotesField value={draft.notes} onChangeText={(text) => setField('notes', text)} />

      <ScreenSectionHeader title="Locations" />
      <PlacesField
        places={draft.places}
        onEdit={(index) => router.navigate({ pathname: '/new-contact/place', params: { index } })}
        onAdd={() => router.navigate('/new-contact/place')}
        // A fill puts the place it read first.
        filledIndex={fill?.fields.includes('places') ? 0 : undefined}
      />

      {/* The lists step is pushed inside the sheet. */}
      <ScreenSectionHeader title="Lists" />
      <ListsField
        lists={selectedLists}
        onRemove={(list) => setListIds(listIds.filter((id) => id !== list.id))}
        onAdd={() => router.navigate('/new-contact/lists')}
      />
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  // More room above the photo than the sheet's gap, so the quick adds read as their own group.
  photo: {
    marginTop: space.sm,
  },
});
