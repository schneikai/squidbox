import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import ContactAlbums from './ContactAlbums';
import ContactMenu from './ContactMenu';
import ContactPhotosStrip from './ContactPhotosStrip';
import HandleField from './HandleField';
import PlacesField from './PlacesField';
import { HANDLE_FIELDS, contactDraft, storedContactFields } from './contactFields';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import DetailScrollView from '@/components/DetailScrollView';
import Divider from '@/components/Divider';
import Field from '@/components/Field';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SuperPressable from '@/components/SuperPressable';
import TextInput from '@/components/TextInput';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import assetQuery from '@/features/asset-list/assetQuery';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactLists from '@/features/contact-list/useContactLists';
import useContacts from '@/features/contacts-context/useContacts';
import PostRows from '@/features/post-list/PostRows';
import useHaptics from '@/hooks/useHaptics';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import { scale } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import * as contacts from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

const PHOTOS_SHOWN = 6;

// A contact, edited as you type (useSaveAsYouType): its avatar, name, handles, places and notes,
// then the lists it is in and the photos, albums and posts it is on. The heart and ⋯ share the
// header's pill; a double tap on the avatar toggles the favorite too.
export default function Contact({ contact }) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const { toggleFavoriteContact, setAvatarAsync } = useContacts();
  const [draft, setDraft] = useState(() => contactDraft(contact));
  const { flush } = useSaveAsYouType(storedContactFields(draft), save);
  const lists = useContactLists(contact.id);
  const photoScope = { contactId: contact.id };
  const photos = usePhotos(photoScope);

  const subtitle = [contact.places[0], `added ${dateToTimeAgo(contact.createdAt)}`].filter(Boolean).join(' · ');

  // Writes the fields that changed since the last save; an emptied name keeps the stored one.
  async function save(next, stored) {
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(stored[key])),
    );
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

  async function handlePickPhoto() {
    const [picked] =
      (await pickImageFromMediaLibrary({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
      })) ?? [];
    if (!picked) return;
    try {
      await setAvatarAsync(contact.id, picked.uri);
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
        <View style={styles.avatar}>
          <SuperPressable onDoublePress={handleToggleFavorite} accessibilityHint="Double tap to favorite">
            <ContactAvatar contact={contact} size="hero" isFavorite={contact.isFavorite} />
          </SuperPressable>
          <Button
            label={contact.avatarFilename ? 'Change photo' : 'Add photo'}
            size="small"
            onPress={handlePickPhoto}
          />
        </View>

        <Field label="Name">
          <TextInput
            variant="field"
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            onBlur={() => flush()}
            placeholder={contact.name}
            textContentType="name"
          />
        </Field>

        <Card style={styles.card}>
          {HANDLE_FIELDS.map(({ field, label, placeholder }, index) => (
            <View key={field}>
              {index > 0 && <Divider />}
              <HandleField
                field={field}
                label={label}
                value={draft[field]}
                onChangeText={(text) => setField(field, text)}
                onBlur={() => flush()}
                placeholder={placeholder}
              />
            </View>
          ))}
        </Card>

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
          minHeight={scale(88)}
        />

        <ScreenSectionHeader title="Lists" />
        <ChipRow>
          {lists?.map((list) => (
            <Chip key={list.id} label={list.name} onPress={() => router.navigate(`/contact-list/${list.id}`)} />
          ))}
          <Chip
            variant="add"
            label="Add to list"
            onPress={() => router.navigate({ pathname: '/add-to-contact-list', params: { contactIds: contact.id } })}
          />
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
        <ContactAlbums contactId={contact.id} emptyText="Not on an album" />

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
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  card: {
    marginTop: 12,
  },
});
