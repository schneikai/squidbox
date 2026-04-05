import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SCREEN_PADDING } from '@/constants';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import GradientPillButton from '@/components/GradientPillButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, scale, spacing, typography } from '@/styles/designTokens';

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
    <View style={[styles.container, { paddingBottom: bottom || SCREEN_PADDING }]}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Notes"
        rightSlot={
          <View style={styles.rightActions}>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                actionButtonStyles.pillButton,
                pressed && { backgroundColor: colors.pressedBg },
              ]}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={spacing.iconSize} color={colors.danger} />
            </Pressable>
            <GradientPillButton label="Save" onPress={handleSave} />
          </View>
        }
      />
      <View style={[styles.inputCard, { marginTop: MODAL_HEADER_HEIGHT + 8 }]}>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a note…"
          placeholderTextColor={colors.textTertiary}
          multiline
          autoFocus
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },
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
    fontSize: typography.input,
    lineHeight: 24,
    color: colors.text,
    padding: SCREEN_PADDING,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
