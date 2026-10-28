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
const ALREADY_TEXT = 'This post is in your Favorites already.';

// One favorite, as a draft sheet: `{ id }` edits it (Done, or Delete, which the Favorites screen
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
  // Why Add or Done didn't save the favorite, until the text changes.
  const [notice, setNotice] = useState(null);
  const { sheetProps, finish } = useEditSheet({
    isNew: !id,
    isValid: Boolean(text.trim()),
    isDirty: text.trim() !== seed.text,
    save,
  });

  async function save() {
    const db = getDb();
    if (!id) {
      if ((await addFavorites(db, [text], null)).length > 0) return true;
      setNotice(ALREADY_TEXT);
      return false;
    }
    try {
      await updateFavorite(db, id, text);
      return true;
    } catch (error) {
      if (error.message !== ALREADY_IN_FAVORITES) throw error;
      setNotice(ALREADY_TEXT);
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

  function handleChangeText(next) {
    setText(next);
    setNotice(null);
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Favorite"
      value={text}
      onChangeText={handleChangeText}
      placeholder="Paste one of your posts"
      maxLength={FAVORITE_LIMITS.text}
      autoFocus={!id}
      description={notice}
      actions={id ? [{ label: 'Delete favorite', tone: 'danger', onPress: handleDelete }] : null}
    />
  );
}
