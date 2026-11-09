import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import {
  addOnAll,
  changeTags,
  draftEdit,
  draftTags,
  isDirty,
  mixedTags,
  putOnAll,
  room,
  startAlbumTags,
} from './albumTagsDraft';
import readAlbumTagsSeed, { type AlbumTagsSeed } from './readAlbumTagsSeed';
import saveAlbumTags from './saveAlbumTags';
import useAlbumTagIt from './useAlbumTagIt';

import EditSheet from '@/components/EditSheet';
import TagsField from '@/components/TagsField';
import TagsSection from '@/components/TagsSection';
import { SectionFooter } from '@/components/settings-list/SettingsList';
import useAppSettings from '@/features/app-settings/useAppSettings';
import useEditSheet from '@/hooks/useEditSheet';
import useHaptics from '@/hooks/useHaptics';
import useSeedOrClose from '@/hooks/useSeedOrClose';
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
  const { tagIt, isRunning, error } = useAlbumTagIt();
  const { sheetProps } = useEditSheet({ isDirty: isDirty(draft), save });

  const tags = draftTags(draft);
  const count = seed.photos.length;

  // Writes only the change, made on each photo's stored tags, so a tag stored meanwhile stays.
  function save() {
    return saveAlbumTags(getDb(), albumId, draftEdit(draft));
  }

  // The chips take no taps while Tag it runs, so the draft here is the latest.
  function handlePutOnAll(tag: string) {
    const next = putOnAll(draft, tag);
    if (!next) {
      haptics.error();
      Alert.alert(`Some photos already have ${ASSET_TAG_LIMITS.tags} tags. Take a tag off first.`);
      return;
    }
    setDraft(next);
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
      {/* One block, so the footer sits under the card as a section's footer does. */}
      <View>
        <TagsSection
          title="On its photos"
          isFirst
          tagItLabel="Tag it"
          onTagIt={handleTagIt}
          isTagging={isRunning}
          error={error}
        >
          <TagsField
            tags={tags}
            onChange={(next) => setDraft((current) => changeTags(current, next))}
            mixed={{ tags: mixedTags(draft), onPress: handlePutOnAll }}
            maxTags={tags.length + room(draft)}
            maxTagLength={ASSET_TAG_LIMITS.tag}
            disabled={isRunning}
          />
        </TagsSection>
        <SectionFooter>
          Dashed tags are only on some photos: tap one to put it on all. Add puts a tag on all photos, × takes it off
          all.
        </SectionFooter>
      </View>
    </EditSheet>
  );
}
