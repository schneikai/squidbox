import { useEffect, useRef, useState } from 'react';

import useHaptics from '@/hooks/useHaptics';
import { getDb } from '@/sync/db/client';
import { removeFavorite, restoreFavorite } from '@/sync/favoritesRepository';
import { requestSync } from '@/sync/worker';

// How long the Undo bar offers to bring a removed favorite back.
const UNDO_MS = 5000;

/**
 * Removing a favorite with Undo, for the Favorites screen and its live `favorites`: `remove(favorite)`
 * tombstones it at once (the tombstone is the truth) and keeps its card in place, dimmed
 * (`removedId`), while the Undo bar shows (`isUndoVisible`, for UNDO_MS). `undo()` restores it; the
 * time running out, a second removal or leaving the screen lets it go. `showRemoved(favorite)` does
 * the same for one the sheet removed itself. `list` is `favorites` with the removed one in its
 * place, until the live list has it back after an Undo.
 */
export default function useRemoveWithUndo(favorites) {
  const haptics = useHaptics();
  // The removed favorite whose card stays, and whether Undo brought it back.
  const [held, setHeld] = useState(null);
  const [isUndoVisible, setIsUndoVisible] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const isBack = !!held && !!favorites?.some(({ id }) => id === held.favorite.id);
  // Restored and read back: the live row takes over.
  if (held?.isRestored && isBack) setHeld(null);

  const list = held && !isBack && favorites ? [...favorites, held.favorite].sort(newestFirst) : favorites;

  function showRemoved(favorite) {
    clearTimeout(timerRef.current);
    setHeld({ favorite, isRestored: false });
    setIsUndoVisible(true);
    timerRef.current = setTimeout(() => {
      setIsUndoVisible(false);
      setHeld((current) => (current?.isRestored ? current : null));
    }, UNDO_MS);
  }

  async function remove(favorite) {
    haptics.selection();
    showRemoved(favorite);
    try {
      await removeFavorite(getDb(), favorite.id);
      requestSync();
    } catch (error) {
      console.error('Removing the favorite failed', error);
      haptics.error();
      clearTimeout(timerRef.current);
      setIsUndoVisible(false);
      setHeld(null);
    }
  }

  async function undo() {
    if (!held || held.isRestored) return;
    clearTimeout(timerRef.current);
    setIsUndoVisible(false);
    setHeld({ ...held, isRestored: true });
    try {
      await restoreFavorite(getDb(), held.favorite.id);
      requestSync();
    } catch (error) {
      console.error('Restoring the favorite failed', error);
      haptics.error();
      setHeld(null);
    }
  }

  return {
    list,
    removedId: held && !held.isRestored ? held.favorite.id : null,
    isUndoVisible,
    remove,
    undo,
    showRemoved,
  };
}

// The live list's order: newest createdAt first, then id.
function newestFirst(a, b) {
  return b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1);
}
