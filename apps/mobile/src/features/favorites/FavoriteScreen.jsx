import { FAVORITE_LIMITS } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import TextEditScreen from '@/components/TextEditScreen';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
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

// One favorite, saved as you type: `{ id }` edits it (or Delete, which the Favorites screen offers to
// undo); no params adds one of your own posts, created once it has text and dropped if you leave it
// empty. Reachable from anywhere (a root screen), so the chat opens it too.
export default function FavoriteScreen({ route, navigation }) {
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
  const haptics = useHaptics();
  const [text, setText] = useState(seed.text);
  const [isTaken, setIsTaken] = useState(false);
  // The favorite's id once there is one (a new one gets it with its first text), and whether Delete
  // removed it, after which nothing is saved.
  const idRef = useRef(id);
  const isRemovedRef = useRef(false);
  const flush = useSaveAsYouType(text.trim(), saveText);

  async function saveText(next, previous, { isLeaving }) {
    if (isRemovedRef.current) return true;
    const db = getDb();
    if (!next) {
      // Empty: a favorite this screen added goes when you leave; one you opened keeps its text.
      if (isLeaving && !id && idRef.current) {
        await removeFavorite(db, idRef.current);
        requestSync();
      }
      return false;
    }
    if (idRef.current) {
      try {
        await updateFavorite(db, idRef.current, next);
      } catch (error) {
        if (error.message !== ALREADY_IN_FAVORITES) throw error;
        setIsTaken(true);
        return false;
      }
    } else {
      const [created] = await addFavorites(db, [next], null);
      if (!created) {
        setIsTaken(true);
        return false;
      }
      idRef.current = created.id;
    }
    setIsTaken(false);
    requestSync();
    return true;
  }

  // No confirm: the Favorites screen shows the card dimmed with Undo.
  async function handleDelete() {
    if (isRemovedRef.current) return;
    isRemovedRef.current = true;
    try {
      await removeFavorite(getDb(), id);
      requestSync();
      navigation.navigate({ name: 'FavoritesScreen', params: { removedId: id }, merge: true });
    } catch (error) {
      console.error('Deleting the favorite failed', error);
      haptics.error();
      Alert.alert("Couldn't delete the favorite", error.message);
      isRemovedRef.current = false;
    }
  }

  return (
    <TextEditScreen
      title="Favorite"
      value={text}
      onChangeText={setText}
      onBlur={() => flush()}
      onBack={() => navigation.goBack()}
      placeholder="Paste one of your posts"
      maxLength={FAVORITE_LIMITS.text}
      autoFocus={!id}
      description={isTaken ? 'This post is in your Favorites already.' : id ? (seed.source ?? 'Your post') : null}
      action={id ? { label: 'Delete favorite', tone: 'danger', onPress: handleDelete } : null}
    />
  );
}
