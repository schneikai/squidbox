import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  addOnAll,
  changeTags,
  draftEdit,
  draftTags,
  isDirty,
  partialTags,
  putOnAll,
  room,
  startAlbumTags,
} from './albumTagsDraft';
import readAlbumTagsSeed, { type AlbumTagsSeed } from './readAlbumTagsSeed';
import saveAlbumTags from './saveAlbumTags';
import useAlbumTagIt from './useAlbumTagIt';

import Button from '@/components/Button';
import EditSheet from '@/components/EditSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import TagsField from '@/components/TagsField';
import { SectionFooter } from '@/components/settings-list/SettingsList';
import useAppSettings from '@/features/app-settings/useAppSettings';
import useEditSheet from '@/hooks/useEditSheet';
import useHaptics from '@/hooks/useHaptics';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import { getDb } from '@/sync/db/client';

/**
 * An album's Tags (`?albumId=`, from its ⋯ menu): every tag on any of its photos in one card, a tag
 * on all of them as a chip and one on only some dashed (a tap, or typing it in Add, puts it on all).
 * Add puts a tag on all photos, × takes it off all; the assistant's Tag it adds tags that fit the
 * whole album. A draft: Save writes the changes to every photo.
 */
export default function AlbumTagsScreen() {
  const { albumId } = useLocalSearchParams<{ albumId?: string }>();
  const { albumSortOrders } = useAppSettings();
  // A link to an album this app doesn't know (or a smart one) closes the sheet, as a deleted one does.
  const seed = useSeedOrClose(
    async (db) => (albumId ? readAlbumTagsSeed(db, albumId, albumSortOrders) : null),
    albumId ?? '',
    'It was deleted',
  );
  if (!seed || !albumId) return null;
  return <AlbumTagsSheet albumId={albumId} seed={seed} />;
}

type AlbumTagsSheetProps = { albumId: string; seed: AlbumTagsSeed };

function AlbumTagsSheet({ albumId, seed }: AlbumTagsSheetProps) {
  const [draft, setDraft] = useState(() => startAlbumTags(seed.photos));
  const haptics = useHaptics();
  const isAssistantAvailable = useIsAssistantAvailable();
  const { tagIt, isRunning, error } = useAlbumTagIt();
  const { sheetProps } = useEditSheet({ isDirty: isDirty(draft), save });

  const tags = draftTags(draft);
  const count = seed.photos.length;

  // Writes only the change, made on each photo's stored tags, so a tag stored meanwhile stays.
  function save() {
    return saveAlbumTags(getDb(), albumId, draftEdit(draft));
  }

  function handlePutOnAll(tag: string) {
    if (!putOnAll(draft, tag)) {
      haptics.error();
      Alert.alert(`Some photos already have ${ASSET_TAG_LIMITS.tags} tags. Take a tag off first.`);
      return;
    }
    setDraft((current) => putOnAll(current, tag) ?? current);
  }

  // An edit made while it ran stays: its tags join the draft as it is then.
  async function handleTagIt() {
    const found = await tagIt(seed.photos.map((photo) => photo.id));
    if (found) setDraft((current) => addOnAll(current, found));
  }

  return (
    <EditSheet
      {...sheetProps}
      title="Tags"
      subtitle={count > 1 ? `on all ${count} photos` : undefined}
      testID="album-tags-sheet"
    >
      <View>
        <ScreenSectionHeader
          title="On its photos"
          isFirst
          trailing={
            isAssistantAvailable && (
              <Button label="Tag it" icon="sparkle" size="small" onPress={handleTagIt} loading={isRunning} />
            )
          }
        />
        <View style={styles.section}>
          <TagsField
            tags={tags}
            onChange={(next) => setDraft((current) => changeTags(current, next))}
            partial={{
              tags: partialTags(draft),
              onPress: handlePutOnAll,
              label: 'on some photos',
              hint: 'Puts it on all photos',
            }}
            maxTags={tags.length + room(draft)}
            maxTagLength={ASSET_TAG_LIMITS.tag}
            itemName="tag"
            disabled={isRunning}
          />
          {!!error && <Text style={listTextStyles.subtitle}>{error}</Text>}
        </View>
        <SectionFooter>
          Dashed tags are only on some photos: tap one to put it on all. Add puts a tag on all photos, × takes it off
          all.
        </SectionFooter>
      </View>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
});
