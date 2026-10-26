import { FAVORITE_LIMITS } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/Card';
import DetailScrollView from '@/components/DetailScrollView';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import TextButton from '@/components/TextButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import useConfirmDiscard from '@/hooks/useConfirmDiscard';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { colors, scale, typography } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import {
  ALREADY_IN_FAVORITES,
  addFavorites,
  readFavorite,
  removeFavorite,
  updateFavorite,
} from '@/sync/favoritesRepository';
import { requestSync } from '@/sync/worker';

const NEW_FAVORITE = { text: '', source: null };

// One favorite: `{ id }` edits it (its text, or Delete, which the Favorites screen offers to undo),
// no params adds one of your own posts. Reachable from anywhere (a root modal, one per favorite), so
// the chat opens it too.
export default function FavoriteModal({ route, navigation }) {
  const id = route.params?.id;
  const isAvailable = useLeaveWhenUnavailable();
  const seed = useSeedOrClose(
    (db) => (id ? readFavorite(db, id) : Promise.resolve(NEW_FAVORITE)),
    id ?? 'new',
    'This favorite was removed.',
  );
  if (!isAvailable || !seed) return null;
  return <FavoriteEditor id={id} seed={seed} navigation={navigation} />;
}

function FavoriteEditor({ id, seed, navigation }) {
  const { bottom } = useSafeAreaInsets();
  const haptics = useHaptics();
  const [text, setText] = useState(seed.text);
  const [isSaving, setIsSaving] = useState(false);
  // Set at once (state lands a render later), so a double tap writes once.
  const isWritingRef = useRef(false);
  const trimmed = text.trim();
  const isDirty = text !== seed.text;
  const allowLeave = useConfirmDiscard(navigation, isDirty);

  const canSave = !!trimmed && trimmed !== seed.text;

  async function handleSave() {
    if (isWritingRef.current) return;
    isWritingRef.current = true;
    setIsSaving(true);
    try {
      const db = getDb();
      if (id) {
        await updateFavorite(db, id, trimmed);
      } else {
        const [created] = await addFavorites(db, [trimmed], null);
        if (!created) throw new Error(ALREADY_IN_FAVORITES);
      }
      requestSync();
      haptics.success();
      allowLeave();
      navigation.goBack();
    } catch (error) {
      haptics.error();
      if (error.message === ALREADY_IN_FAVORITES) {
        Alert.alert(ALREADY_IN_FAVORITES, 'This post is in your Favorites already.');
      } else {
        console.error('Saving the favorite failed', error);
        Alert.alert("Couldn't save the favorite", error.message);
      }
      isWritingRef.current = false;
      setIsSaving(false);
    }
  }

  // No confirm: the Favorites screen shows the card dimmed with Undo.
  async function handleDelete() {
    if (isWritingRef.current) return;
    isWritingRef.current = true;
    try {
      await removeFavorite(getDb(), id);
      requestSync();
      allowLeave();
      navigation.navigate({ name: 'FavoritesScreen', params: { removedId: id }, merge: true });
    } catch (error) {
      console.error('Deleting the favorite failed', error);
      haptics.error();
      Alert.alert("Couldn't delete the favorite", error.message);
      isWritingRef.current = false;
    }
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Favorite"
        rightSlot={
          <PrimaryButton size="compact" label="Save" onPress={handleSave} disabled={!canSave} loading={isSaving} />
        }
      />
      <DetailScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        <Card>
          <Textarea
            value={text}
            onChangeText={setText}
            placeholder="Paste one of your posts"
            maxLength={FAVORITE_LIMITS.text}
            minHeight={scale(160)}
            autoFocus
            style={styles.input}
          />
        </Card>
        {id && <Text style={styles.source}>{seed.source ?? 'Your post'}</Text>}
        {id && (
          <View style={styles.actions}>
            <TextButton label="Delete favorite" tone="danger" onPress={handleDelete} />
          </View>
        )}
      </DetailScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT + 8,
    gap: 12,
  },
  input: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  source: {
    marginHorizontal: 4,
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 24,
  },
});
