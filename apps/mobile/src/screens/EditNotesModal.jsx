import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientPillButton from '@/components/GradientPillButton';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import { colors } from '@/styles/designTokens';

export default function EditNotesModal({ route, navigation }) {
  const { type, id, notes: initialNotes } = route.params;
  const { bottom } = useSafeAreaInsets();
  const [notes, setNotes] = useState(initialNotes ?? '');

  const { updateAlbum } = useAlbums();
  const { updateAsset } = useAssets();

  async function handleSave() {
    const value = notes.trim() === '' ? null : notes.trim();
    if (type === 'album') {
      await updateAlbum(id, { notes: value });
    } else {
      await updateAsset(id, { notes: value });
    }
    navigation.goBack();
  }

  async function handleDelete() {
    if (type === 'album') {
      await updateAlbum(id, { notes: null });
    } else {
      await updateAsset(id, { notes: null });
    }
    navigation.goBack();
  }

  return (
    <ModalSheet style={{ paddingBottom: bottom || SCREEN_PADDING }}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Notes"
        rightSlot={
          <View style={styles.rightActions}>
            <IconButton icon="trash" onPress={handleDelete} color={colors.danger} accessibilityLabel="Delete note" />
            <GradientPillButton label="Save" onPress={handleSave} />
          </View>
        }
      />
      <View style={[styles.inputCard, { marginTop: MODAL_HEADER_HEIGHT + 8 }]}>
        <Textarea value={notes} onChangeText={setNotes} placeholder="Add a note…" autoFocus style={styles.input} />
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    flex: 1,
    margin: SCREEN_PADDING,
    backgroundColor: colors.glassSurface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  input: {
    flex: 1,
    padding: SCREEN_PADDING,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
