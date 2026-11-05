import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import DuplicatesCard from './DuplicatesCard';
import QuickAddBar from './QuickAddBar';
import findDuplicates from './findDuplicates';
import useContactHandles from './useContactHandles';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import EditSheet from '@/components/EditSheet';
import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import HandleField from '@/features/contact-detail/HandleField';
import PlacesField from '@/features/contact-detail/PlacesField';
import { HANDLE_FIELDS, contactDraft, storedContactFields } from '@/features/contact-detail/contactFields';
import contactListQuery from '@/features/contact-list/contactListQuery';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useHaptics from '@/hooks/useHaptics';
import { useLiveQuery } from '@/sync/useLiveQuery';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

const EMPTY = JSON.stringify(storedContactFields(contactDraft()));

// The New contact sheet: a photo, the name, handles, phone and places, and the lists to put it in
// (a step pushed inside the sheet). Contacts it may duplicate show above the form, their shared
// fields marked. Add saves it and opens it.
export default function NewContactScreen() {
  const haptics = useHaptics();
  const { addContact, addToLists, setAvatarAsync } = useContacts();
  const { draft, setField, avatarUri, setAvatarUri, listIds, filledFields } = useNewContactDraft();
  const handles = useContactHandles();
  const listNames = useListNames(listIds);

  const fields = storedContactFields(draft);
  const { matches, sharedFields } = findDuplicates(fields, handles ?? []);
  const isDirty = JSON.stringify(fields) !== EMPTY || !!avatarUri || listIds.length > 0;
  const { sheetProps, finish, confirmDiscard } = useEditSheet({
    isNew: true,
    isValid: !!fields.name,
    isDirty,
    save,
    syncsItself: true,
  });

  async function save() {
    const contact = await addContact(fields);
    // The contact is added either way; a photo that couldn't be made is said, not lost silently.
    if (avatarUri) {
      await setAvatarAsync(contact.id, avatarUri).catch((error) =>
        Alert.alert("Couldn't add the photo", error.message),
      );
    }
    if (listIds.length > 0) await addToLists([contact.id], listIds);
    haptics.success();
    return () => router.replace(`/contact/${contact.id}`);
  }

  async function handlePickPhoto() {
    const [picked] =
      (await pickImageFromMediaLibrary({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
      })) ?? [];
    if (picked) setAvatarUri(picked.uri);
  }

  // Opening a duplicate leaves the draft, after asking when it has changes.
  async function handleOpenDuplicate(contact) {
    if (await confirmDiscard())
      finish(() => () => router.replace(`/contact/${contact.id}`), "Couldn't open the contact");
  }

  return (
    <EditSheet {...sheetProps} title="New contact">
      <QuickAddBar />
      {matches.length > 0 && <DuplicatesCard matches={matches} onOpen={handleOpenDuplicate} />}

      <View style={styles.avatar}>
        <ContactAvatar contact={{ name: draft.name }} uri={avatarUri} size="hero" />
        <Button label={avatarUri ? 'Change photo' : 'Add photo'} size="small" onPress={handlePickPhoto} />
      </View>

      <Card>
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
        {HANDLE_FIELDS.map(({ field, label, placeholder }) => (
          <View key={field}>
            <Divider />
            <HandleField
              field={field}
              label={label}
              value={draft[field]}
              onChangeText={(text) => setField(field, text)}
              placeholder={placeholder}
              isFilled={filledFields.includes(field)}
              isDuplicate={sharedFields.has(field)}
              isOpenable={false}
            />
          </View>
        ))}
      </Card>

      <PlacesField places={draft.places} onChange={(places) => setField('places', places)} />

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

// The names of the lists picked, by name.
function useListNames(listIds) {
  const query = contactListQuery();
  const lists = useLiveQuery((db) => query.read(db), query.tables, [query.descriptor]);
  return (lists ?? []).filter((list) => listIds.includes(list.id)).map((list) => list.name);
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    gap: 4,
  },
});
