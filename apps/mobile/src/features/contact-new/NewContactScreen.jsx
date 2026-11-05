import { and, asc, isNull, sql } from 'drizzle-orm';
import { router } from 'expo-router';
import { Alert } from 'react-native';

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
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import useHaptics from '@/hooks/useHaptics';
import { schema } from '@/sync/db/client';
import { inJson } from '@/sync/inJson';
import { useLiveQuery } from '@/sync/useLiveQuery';

const EMPTY = JSON.stringify(storedContactFields(contactDraft()));

// The New contact sheet: a photo, the name, handles, phone and places, and the lists to put it in
// (a step pushed inside the sheet). Contacts it may duplicate show above the form, their shared
// fields marked. Add saves it and opens it.
export default function NewContactScreen() {
  const haptics = useHaptics();
  const { addContact } = useContacts();
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
    const { contact, avatarError } = await addContact(fields, { avatarUri, listIds });
    // The contact is added either way; a photo that couldn't be made is said, not lost silently.
    if (avatarError) Alert.alert("Couldn't add the photo", avatarError.message);
    haptics.success();
    return () => router.replace(`/contact/${contact.id}`);
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

      <ContactAvatarPicker
        contact={{ name: draft.name }}
        uri={avatarUri}
        hasPhoto={!!avatarUri}
        onPick={setAvatarUri}
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

// The names of the lists picked, by name, live.
function useListNames(listIds) {
  const l = schema.contactLists;
  const lists = useLiveQuery(
    (db) =>
      db
        .select({ name: l.name })
        .from(l)
        .where(and(isNull(l.deletedAt), inJson(l.id, listIds)))
        .orderBy(asc(sql`${l.name} collate nocase`), asc(l.id)),
    [schema.contactLists],
    [listIds.join(',')],
  );
  return (lists ?? []).map((list) => list.name);
}
