import { usePreventRemove, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import confirmDiscardAsync from '@/utils/confirmDiscardAsync';

// Marks an action whose discard the user confirmed, so a sheet's other guarded routes (an editor
// pushed inside the post editor's sheet) let it through instead of asking again. Expo Router's
// stack copies the action from route to route, with this key.
const DISCARD_CONFIRMED = Symbol('DISCARD_CONFIRMED');

/**
 * Asks "Discard changes?" before a sheet with unsaved changes (`isDirty`) goes, whichever way it
 * goes: ×, Back, a swipe down or back, or another screen navigated to in its place. React
 * Navigation's usePreventRemove blocks the removal: a native swipe snaps the sheet back and the
 * question comes from `beforeRemove`, and a screen pushed inside another sheet blocks that sheet's
 * swipe too. On Discard the blocked action runs, and asks no other guard again. While the sheet
 * `isSaving`, it stays without asking: the save closes it. `leave(navigate)` goes without asking,
 * for the sheet's own ways out (saved, deleted, duplicated): it disarms the guard, then runs
 * `navigate` once (`navigation.goBack()` when not given). `confirmDiscard()` asks the same question
 * before an action that would drop the changes, and resolves to true at once when there are none.
 */
export default function useDiscardGuard(isDirty: boolean, isSaving = false) {
  const navigation = useNavigation();
  const [pending, setPending] = useState<{ navigate: () => void } | null>(null);
  const isAskingRef = useRef(false);

  usePreventRemove((isDirty || isSaving) && !pending, async ({ data }) => {
    if (isSaving || isAskingRef.current) return;
    // The blocked action runs once the guard is off (`leave`). Dispatched while it is on, the copy
    // is a new removal that this guard blocks again, and it comes back here with its mark, over and
    // over (React's "Maximum update depth exceeded"). So don't dispatch it here directly.
    // The mark rides on the action as an extra key (see DISCARD_CONFIRMED), which its type doesn't name.
    if ((data.action as { [DISCARD_CONFIRMED]?: true })[DISCARD_CONFIRMED]) {
      leave(() => navigation.dispatch(data.action));
      return;
    }
    isAskingRef.current = true;
    try {
      if (await confirmDiscardAsync())
        leave(() => navigation.dispatch({ ...data.action, [DISCARD_CONFIRMED]: true } as typeof data.action));
    } finally {
      isAskingRef.current = false;
    }
  });

  useEffect(() => {
    pending?.navigate();
  }, [pending]);

  function leave(navigate: () => void = () => navigation.goBack()) {
    setPending({ navigate });
  }

  function confirmDiscard(): Promise<boolean> {
    return isDirty ? confirmDiscardAsync() : Promise.resolve(true);
  }

  return { leave, confirmDiscard };
}
