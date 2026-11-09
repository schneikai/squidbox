import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import albumTagsDraft from './albumTagsDraft';
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
  const [draft, setDraft] = useState(() => albumTagsDraft.start(seed.photos));
  const haptics = useHaptics();
  const { tagIt, isRunning, error } = useAlbumTagIt();
  // Save waits for Tag it, whose tags it would leave out; × still closes (and stops it).
  const { sheetProps } = useEditSheet({ isValid: !isRunning, isDirty: albumTagsDraft.isDirty(draft), save });

  const tags = albumTagsDraft.tags(draft);
  const count = seed.photos.length;

  // Writes only the change, made on each photo's stored tags, so a tag stored meanwhile stays.
  function save() {
    return saveAlbumTags(getDb(), albumId, albumTagsDraft.edit(draft));
  }

  function handlePutOnAll(tag: string) {
    setDraft((current) => albumTagsDraft.putOnAll(current, tag));
  }

  // An edit made while it ran stays: its tags join the draft as it is then.
  async function handleTagIt() {
    const found = await tagIt(seed.photos.map((photo) => photo.id));
    if (!found) return;
    setDraft((current) => albumTagsDraft.addOnAll(current, found));
    haptics.success();
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
            onChange={(next) => setDraft((current) => albumTagsDraft.change(current, next))}
            mixed={{ tags: albumTagsDraft.mixedTags(draft), onPress: handlePutOnAll }}
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
