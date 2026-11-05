import { CONTACT_LIMITS } from '@squidbox/shared';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import ContactAvatarPicker from './ContactAvatarPicker';
import ContactMenu from './ContactMenu';
import ContactPhotosStrip from './ContactPhotosStrip';
import HandleFieldsCard from './HandleFieldsCard';
import PlacesField from './PlacesField';
import { contactDraft, storedContactFields } from './contactFields';
import useListsOfContact from './useListsOfContact';

import Button from '@/components/Button';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import TextInput from '@/components/TextInput';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import assetQuery from '@/features/asset-list/assetQuery';
import addToContactListHref from '@/features/contact-list-picker/addToContactListHref';
import useContacts from '@/features/contacts-context/useContacts';
import PostRows from '@/features/post-list/PostRows';
import useHaptics from '@/hooks/useHaptics';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import { scale } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import * as contacts from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import changedValues from '@/utils/changedValues';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

const PHOTOS_SHOWN = 6;

// A contact, edited as you type (useSaveAsYouType): its avatar, name, handles, places and notes,
// then the lists it is in and the photos, albums and posts it is on. A change another device makes
// while it is open shows in the fields not edited here since. The heart and ⋯ share the
// header's pill; a double tap on the avatar toggles the favorite too.
export default function Contact({ contact }) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const { toggleFavoriteContact, setAvatarAsync } = useContacts();
  const [draft, setDraft] = useState(() => contactDraft(contact));
  const [seen, setSeen] = useState(contact); // the stored contact the draft last took in
  const saver = useSaveAsYouType(storedContactFields(draft), save);
  const { flush } = saver;
  const lists = useListsOfContact(contact.id);
  const photoScope = { contactId: contact.id };
  const photos = usePhotos(photoScope);
  // The saver compares with the stored contact as it is now, so a change from elsewhere isn't written back.
  useEffect(() => {
    saver.adopt(storedContactFields(contactDraft(contact)));
  }, [saver, contact]);

  // A stored change from elsewhere: each field still as it was stored before takes the new value.
  if (contact.updatedAt !== seen.updatedAt) {
    const before = contactDraft(seen);
    const after = contactDraft(contact);
    setSeen(contact);
    setDraft((current) =>
      Object.fromEntries(
        Object.entries(current).map(([field, value]) => [
          field,
          JSON.stringify(value) === JSON.stringify(before[field]) ? after[field] : value,
        ]),
      ),
    );
  }
  const subtitle = [contact.places[0], `added ${dateToTimeAgo(contact.createdAt)}`].filter(Boolean).join(' · ');

  // Writes the fields that changed since the last save; an emptied name keeps the stored one.
  async function save(next, stored) {
    const changes = changedValues(stored, next);
    if (changes.name === '') delete changes.name;
    if (Object.keys(changes).length > 0) await contacts.update(getDb(), contact.id, changes);
  }

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleToggleFavorite() {
    haptics.selection();
    toggleFavoriteContact(contact.id);
  }

  async function handlePickPhoto(uri) {
    try {
      await setAvatarAsync(contact.id, uri);
    } catch (error) {
      Alert.alert("Couldn't change the photo", error.message);
    }
  }

  return (
    <Page>
      <FloatingDetailHeader
        title={contact.name}
        subtitle={subtitle}
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
        <ContactAvatarPicker
          contact={contact}
          hasPhoto={!!contact.avatarFilename}
          isFavorite={contact.isFavorite}
          onPick={handlePickPhoto}
          onDoublePress={handleToggleFavorite}
          style={styles.avatar}
        />

        <Field label="Name">
          <TextInput
            variant="field"
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            onBlur={() => flush()}
            placeholder={contact.name}
            textContentType="name"
            maxLength={CONTACT_LIMITS.name}
          />
        </Field>

        <HandleFieldsCard draft={draft} onChange={setField} onBlur={() => flush()} style={styles.card} />

        <ScreenSectionHeader title="Places" />
        <PlacesField places={draft.places} onChange={(places) => setField('places', places)} onBlur={() => flush()} />

        <ScreenSectionHeader title="Notes" />
        <TextInput
          variant="field"
          multiline
          value={draft.notes}
          onChangeText={(text) => setField('notes', text)}
          onBlur={() => flush()}
          placeholder="Add a note…"
          maxLength={CONTACT_LIMITS.notes}
          minHeight={scale(88)}
        />

        <ScreenSectionHeader title="Lists" />
        <ChipRow>
          {lists?.map((list) => (
            <Chip key={list.id} label={list.name} onPress={() => router.navigate(`/contact-list/${list.id}`)} />
          ))}
          <Chip variant="add" label="Add to list" onPress={() => router.navigate(addToContactListHref([contact.id]))} />
        </ChipRow>

        <ScreenSectionHeader
          title="Photos"
          trailing={
            photos?.count > PHOTOS_SHOWN && (
              <Button
                label={`See all ${photos.count}`}
                size="small"
                onPress={() => router.navigate(`/contact/${contact.id}/photos`)}
              />
            )
          }
        />
        {photos?.count > 0 ? (
          <ContactPhotosStrip assets={photos.rows} scope={photoScope} />
        ) : (
          photos && <Text style={listTextStyles.subtitle}>Not on a photo</Text>
        )}

        <ScreenSectionHeader title="Albums" />
        <AssetAlbums scope={{ contactId: contact.id }} emptyText="Not on an album" />

        <ScreenSectionHeader title="Posts" />
        <PostRows scope={{ contactId: contact.id }} emptyText="Not on a post" />
      </DetailScrollView>
    </Page>
  );
}

function usePhotos(scope) {
  const query = assetQuery({ scope });
  return useLiveQuery((db) => query.read(db, { limit: PHOTOS_SHOWN }), query.tables, [query.descriptor]);
}

const styles = StyleSheet.create({
  avatar: {
    marginBottom: 16,
  },
  card: {
    marginTop: 12,
  },
});
