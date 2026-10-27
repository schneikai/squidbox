import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import { getDb, schema } from '@/sync/db/client';
import { addFavorites, favoriteText, readFavorites, removeFavorite } from '@/sync/favoritesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { requestSync } from '@/sync/worker';

/**
 * Hearting posts the assistant wrote: `favoriteIdOf(text)` is the live favorite with this text, if
 * any; `toggle(text, source)` adds it from `source` or takes it out again.
 */
export default function useFavoriteToggle() {
  const haptics = useHaptics();
  const favorites = useLiveQuery((db) => readFavorites(db), [schema.favorites]);
  const idByText = useMemo(
    () => new Map((favorites ?? []).map((favorite) => [favorite.text, favorite.id])),
    [favorites],
  );

  const favoriteIdOf = useCallback((text) => idByText.get(favoriteText(text)), [idByText]);

  const toggle = useCallback(
    async (text, source) => {
      haptics.selection();
      try {
        const id = idByText.get(favoriteText(text));
        if (id) await removeFavorite(getDb(), id);
        else await addFavorites(getDb(), [text], source);
        requestSync();
      } catch (error) {
        console.error('Changing the favorite failed', error);
        Alert.alert("Couldn't change Favorites", error.message);
      }
    },
    [idByText, haptics],
  );

  return useMemo(() => ({ favoriteIdOf, toggle }), [favoriteIdOf, toggle]);
}
