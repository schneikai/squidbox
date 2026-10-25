import { useEffect, useRef } from 'react';

import confirmDiscardAsync from '@/utils/confirmDiscardAsync';

/**
 * Asks "Discard changes?" before an editor screen with unsaved changes (`isDirty`) goes away: its
 * close button, a swipe down (turned off while dirty, as a native sheet's swipe can't wait for the
 * answer) or a replace. Call the returned `allowLeave()` before leaving on purpose (after a save or a
 * delete), so that doesn't ask.
 */
export default function useConfirmDiscard(navigation, isDirty) {
  const isAllowedRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isDirty });
    return navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || isAllowedRef.current) return;
      event.preventDefault();
      confirmDiscardAsync().then((isConfirmed) => {
        if (!isConfirmed) return;
        isAllowedRef.current = true;
        navigation.dispatch(event.data.action);
      });
    });
  }, [navigation, isDirty]);

  return function allowLeave() {
    isAllowedRef.current = true;
  };
}
