import { FAVORITE_LIMITS } from '@squidbox/shared';
import { useState } from 'react';

import TextEditSheet from '@/components/TextEditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { getDb } from '@/sync/db/client';
import {
  ALREADY_IN_FAVORITES,
  addFavorites,
  readFavorite,
  removeFavorite,
  updateFavorite,
} from '@/sync/favoritesRepository';

const NEW_FAVORITE = { text: '' };

// One favorite, as a draft sheet: `{ id }` edits it (Save, or Delete, which the Favorites screen
// offers to undo); no params adds one of your own posts (Add). A text in your Favorites already says
// so and keeps the sheet open. Reachable from anywhere (a root screen), so the chat opens it too.
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
  const [text, setText] = useState(seed.text);
  // The text Add or Save refused as in your Favorites already: said while the text is still that one.
  const [takenText, setTakenText] = useState(null);
  const { sheetProps, finish } = useEditSheet({
    isNew: !id,
    isValid: Boolean(text.trim()),
    isDirty: text.trim() !== seed.text,
    save,
  });

  const notice = takenText === text ? 'This post is in your Favorites already.' : null;

  async function save() {
    const db = getDb();
    if (!id) {
      if ((await addFavorites(db, [text])).length > 0) return;
      setTakenText(text);
      return false;
    }
    try {
      await updateFavorite(db, id, text);
    } catch (error) {
      if (error.message !== ALREADY_IN_FAVORITES) throw error;
      setTakenText(text);
      return false;
    }
  }

  // No confirm: the Favorites screen shows the card dimmed with Undo.
  function handleDelete() {
    finish(async () => {
      await removeFavorite(getDb(), id);
      return () => navigation.navigate({ name: 'FavoritesScreen', params: { removedId: id }, merge: true });
    }, "Couldn't delete the favorite");
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Favorite"
      value={text}
      onChangeText={setText}
      placeholder="Paste one of your posts"
      maxLength={FAVORITE_LIMITS.text}
      autoFocus={!id}
      description={notice}
      actions={id ? [{ label: 'Delete favorite', colorPalette: 'danger', onPress: handleDelete }] : []}
    />
  );
}
