import { CONTACT_LIMITS } from '@squidbox/shared';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import ContactAvatarPicker from './ContactAvatarPicker';
import ContactMenu from './ContactMenu';
import ContactPhotosStrip from './ContactPhotosStrip';
import HandleFieldsCard from './HandleFieldsCard';
import ListsField from './ListsField';
import NotesField from './NotesField';
import PlacesField from './PlacesField';
import {
  type ContactDraft,
  type ContactFormFields,
  contactDraft,
  draftWithChanges,
  storedContactFields,
} from './contactFields';
import useListsOfContact from './useListsOfContact';

import Button from '@/components/Button';
import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import Text from '@/components/Text';
import TextInput from '@/components/TextInput';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import assetQuery from '@/features/asset-list/assetQuery';
import contactPlace from '@/features/contact-list/contactPlace';
import addToContactListHref from '@/features/contact-list-picker/addToContactListHref';
import useContacts from '@/features/contacts-context/useContacts';
import PostRows from '@/features/post-list/PostRows';
import useHaptics from '@/hooks/useHaptics';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import { layout, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import * as contacts from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import type * as schema from '@/sync/db/schema';
import { useLiveQuery } from '@/sync/useLiveQuery';
import changedValues from '@/utils/changedValues';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

const PHOTOS_SHOWN = 6;

// The first photos a contact is on, and how many there are.
type PhotoPage = { rows: schema.AssetRow[]; count: number };

type ContactProps = { contact: schema.ContactRow };

// A contact, edited as you type (useSaveAsYouType): its avatar, name, handles, notes and places,
// then the lists it is in and the photos, albums and posts it is on. A change another device makes
// while it is open shows in the fields not edited here since. The name is its title, edited in
// place; the camera on the avatar's corner changes the photo. The heart and ⋯ share the header's
// pill; a double tap on the avatar toggles the favorite too.
export default function Contact({ contact }: ContactProps) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const { toggleFavoriteContact, setAvatarAsync, changeListContacts } = useContacts();
  const [draft, setDraft] = useState(() => contactDraft(contact));
  const [seen, setSeen] = useState(contact); // the stored contact the draft last took in
  const saver = useSaveAsYouType(storedContactFields(draft), save);
  const { flush } = saver;
  const lists = useListsOfContact(contact.id);
  // One scope object per contact, so the photos, albums and posts sections don't get a new one on every keystroke.
  const scope = useMemo(() => ({ contactId: contact.id }), [contact.id]);
  const photos = usePhotos(scope);
  // The saver compares with the stored contact as it is now, so a change from elsewhere isn't written back.
  useEffect(() => {
    saver.adopt(storedContactFields(contactDraft(contact)));
  }, [saver, contact]);

  // A stored change from elsewhere: each field still as it was stored before takes the new value.
  if (contact.updatedAt !== seen.updatedAt) {
    const before = contactDraft(seen);
    const after = contactDraft(contact);
    setSeen(contact);
    setDraft((current) => draftWithChanges(current, Object.keys(current) as (keyof ContactDraft)[], before, after));
  }
  const subtitle = [contactPlace(contact), `added ${dateToTimeAgo(contact.createdAt)}`].filter(Boolean).join(' · ');

  // Writes the fields that changed since the last save; an emptied name keeps the stored one.
  async function save(next: ContactFormFields, stored: ContactFormFields) {
    const changes = changedValues(stored, next);
    if (changes.name === '') delete changes.name;
    if (Object.keys(changes).length > 0) await contacts.update(getDb(), contact.id, changes);
  }

  function setField<F extends keyof ContactDraft>(field: F, value: ContactDraft[F]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleToggleFavorite() {
    haptics.selection();
    toggleFavoriteContact(contact.id);
  }

  async function handlePickPhoto(uri: string) {
    try {
      await setAvatarAsync(contact.id, uri);
    } catch (error) {
      Alert.alert("Couldn't change the photo", apiErrorMessage(error));
    }
  }

  // The × in Lists takes the contact off at once, so it asks first. New contact doesn't: its lists are a draft.
  async function handleRemoveFromList(list: { id: string; name: string }) {
    const isConfirmed = await confirmAsync({
      title: `Remove from ${list.name}?`,
      message: `${contact.name || 'The contact'} stays in your contacts.`,
      action: 'Remove',
      destructive: true,
    });
    if (isConfirmed) await changeListContacts(list.id, { added: [], removed: [contact.id] });
  }

  return (
    <Page>
      <FloatingDetailHeader
        onBack={() => navigation.goBack()}
        menuSlot={
          <>
            <Button
              icon="heart"
              colorPalette="favorite"
              isSelected={contact.isFavorite}
              filled={contact.isFavorite}
              onPress={handleToggleFavorite}
              accessibilityLabel={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            />
            <ContactMenu contact={contact} afterDelete={() => navigation.goBack()} />
          </>
        }
      />
      <DetailScrollView keyboardShouldPersistTaps="handled">
        <ContactAvatarPicker contact={contact} onPick={handlePickPhoto} onDoublePress={handleToggleFavorite} />
        <TextInput
          variant="title"
          value={draft.name}
          onChangeText={(text) => setField('name', text)}
          onBlur={() => flush()}
          placeholder={contact.name}
          accessibilityLabel="Name"
          textContentType="name"
          maxLength={CONTACT_LIMITS.name}
          style={styles.name}
        />
        <Text variant="status" style={styles.subtitle}>
          {subtitle}
        </Text>

        <HandleFieldsCard draft={draft} onChange={setField} onBlur={() => flush()} style={styles.handles} />

        <ScreenSectionHeader title="Notes" />
        <NotesField value={draft.notes} onChangeText={(text) => setField('notes', text)} onBlur={() => flush()} />

        <ScreenSectionHeader title="Places" />
        <PlacesField
          places={draft.places}
          onEdit={(index) => router.navigate({ pathname: `/contact/${contact.id}/place`, params: { index } })}
          onAdd={() => router.navigate(`/contact/${contact.id}/place`)}
        />

        <ScreenSectionHeader title="Lists" />
        <ListsField
          lists={lists ?? []}
          onOpen={(listId) => router.navigate(`/contact-list/${listId}`)}
          onRemove={handleRemoveFromList}
          onAdd={() => router.navigate(addToContactListHref([contact.id]))}
        />

        <ScreenSectionHeader
          title="Photos"
          isFlush
          trailing={
            !!photos?.count && (
              <Button
                label={`See all ${photos.count}`}
                size="small"
                onPress={() => router.navigate(`/contact/${contact.id}/photos`)}
              />
            )
          }
        />
        {photos?.count ? (
          <ContactPhotosStrip assets={photos.rows} scope={scope} />
        ) : (
          photos && <Text style={listTextStyles.subtitle}>Not on a photo</Text>
        )}

        <ScreenSectionHeader title="Albums" isFlush />
        <AssetAlbums scope={scope} emptyText="Not on an album" />

        <ScreenSectionHeader title="Posts" isFlush />
        <PostRows scope={scope} emptyText="Not on a post" />
      </DetailScrollView>
    </Page>
  );
}

function usePhotos(scope: { contactId: string }) {
  const query = assetQuery({ scope });
  return useLiveQuery<PhotoPage>((db) => query.read(db, { limit: PHOTOS_SHOWN }), query.tables, [query.descriptor]);
}

const styles = StyleSheet.create({
  name: {
    marginTop: space.lg,
  },
  subtitle: {
    marginTop: space.xs,
    textAlign: 'center',
  },
  handles: {
    marginTop: layout.sectionGap,
  },
});
