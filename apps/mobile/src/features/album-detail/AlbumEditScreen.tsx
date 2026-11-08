import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import EditSheet from '@/components/EditSheet';
import Field from '@/components/Field';
import TextInput from '@/components/TextInput';
import useAlbum from '@/features/album-detail/useAlbum';
import useAlbums from '@/features/albums-context/useAlbums';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useEditSheet from '@/hooks/useEditSheet';
import { scale, space } from '@/styles/designTokens';
import type { AlbumRow } from '@/sync/db/schema';
import changedValues from '@/utils/changedValues';
import isPresent from '@/utils/isPresent';
import noteText from '@/utils/noteText';

// Edit album, from the album's ⋯ menu, its name or its note: its name and note as a draft sheet,
// saved on Save. It sends only what changed, so an edit another device made meanwhile to the other
// field is kept.
export default function AlbumEditScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const album = useAlbum(albumId);
  useCloseWhenGone(album, 'This album was deleted');

  if (!album) return null;
  return <AlbumEditor album={album} />;
}

type AlbumEditorProps = { album: AlbumRow };
type AlbumDraft = { name: string; notes: string };

function AlbumEditor({ album }: AlbumEditorProps) {
  const { updateAlbum } = useAlbums();
  // The album as it was when the sheet opened, so a live update doesn't move the draft's baseline.
  const [seed] = useState({ name: album.name, notes: noteText(album.notes) });
  const [draft, setDraft] = useState<AlbumDraft>({ name: seed.name, notes: seed.notes ?? '' });
  const values = { name: draft.name.trim(), notes: noteText(draft.notes) };
  const changes = changedValues(seed, values);
  const { sheetProps } = useEditSheet({
    isValid: !!values.name,
    isDirty: isPresent(changes),
    save: () => updateAlbum(album.id, changes),
    syncsItself: true,
  });

  function setField(field: keyof AlbumDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <EditSheet {...sheetProps} title="Edit album" testID="album-edit-sheet">
      <View style={styles.fields}>
        <Field label="Name">
          <TextInput
            variant="field"
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            placeholder="Album name"
          />
        </Field>
        <Field label="Note">
          <TextInput
            variant="field"
            multiline
            value={draft.notes}
            onChangeText={(text) => setField('notes', text)}
            placeholder="Add a note…"
            minHeight={scale(120)}
          />
        </Field>
      </View>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: space.xl,
  },
});
