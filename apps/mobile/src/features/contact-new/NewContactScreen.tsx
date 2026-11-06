import type { ContactRecord } from '@squidbox/shared';
import { router } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import DuplicatesCard from './DuplicatesCard';
import QuickAddBar from './QuickAddBar';
import findDuplicates from './findDuplicates';
import useContactHandles from './useContactHandles';
import useNewContactDraft from './useNewContactDraft';

import EditSheet from '@/components/EditSheet';
import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatarPicker from '@/features/contact-detail/ContactAvatarPicker';
import HandleField from '@/features/contact-detail/HandleField';
import HandleFieldsCard from '@/features/contact-detail/HandleFieldsCard';
import PlacesField from '@/features/contact-detail/PlacesField';
import { contactDraft, storedContactFields } from '@/features/contact-detail/contactFields';
import useContactListRows from '@/features/contact-list/useContactListRows';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useHaptics from '@/hooks/useHaptics';

const EMPTY = JSON.stringify(storedContactFields(contactDraft()));

// The New contact sheet: a photo, the name, handles, phone and places, and the lists to put it in
// (a place and the lists are steps pushed inside the sheet). Contacts it may duplicate show above the form, their shared
// fields marked. Add saves it and opens it.
export default function NewContactScreen() {
  const haptics = useHaptics();
  const { addContact } = useContacts();
  const { draft, setField, avatarUri, setAvatarUri, listIds, filledFields } = useNewContactDraft();
  const handles = useContactHandles();
  const lists = useContactListRows({ withMembers: false });
  const fields = storedContactFields(draft);
  const { matches, sharedFields } = findDuplicates(fields, handles ?? []);
  const listNames = (lists ?? []).filter((list) => listIds.includes(list.id)).map((list) => list.name);
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
      Alert.alert("Couldn't add the photo", avatarError instanceof Error ? avatarError.message : String(avatarError));
    }
    haptics.success();
    return () => router.replace(`/contact/${contact.id}`);
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
        hasPhoto={!!avatarUri}
        variant="form"
        onPick={setAvatarUri}
        style={styles.photo}
      />

      <HandleFieldsCard
        draft={draft}
        onChange={setField}
        fieldProps={(field) => ({ isFilled: filledFields.includes(field), isDuplicate: sharedFields.has(field) })}
        isOpenable={false}
      >
        <HandleField
          field="name"
          label="Name"
          value={draft.name}
          onChangeText={(text) => setField('name', text)}
          placeholder="Name"
          isFilled={filledFields.includes('name')}
          isDuplicate={sharedFields.has('name')}
          isOpenable={false}
        />
      </HandleFieldsCard>

      <PlacesField
        places={draft.places}
        onEdit={(index) => router.navigate({ pathname: '/new-contact/place', params: { index } })}
        onAdd={() => router.navigate('/new-contact/place')}
      />

      <Section isHeaderless>
        <Row
          label="Lists"
          value={listNames.length > 0 ? listNames.join(', ') : 'None'}
          onPress={() => router.navigate('/new-contact/lists')}
          hasChevron
        />
      </Section>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  // More room above the photo than the sheet's gap, so the quick adds read as their own group.
  photo: {
    marginTop: 8,
  },
});
