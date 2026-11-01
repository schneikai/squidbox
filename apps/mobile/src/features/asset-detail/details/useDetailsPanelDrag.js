import { useCallback, useMemo, useRef } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { TAP_SLOP } from '@/constants';

/**
 * The details panel's own drag, on the same track as the photo's (`verticalDrag`, useDetailsPanel):
 * a vertical drag anywhere on the panel scrolls the details and, from their top, closes it, and a
 * touch on the moving panel catches it. `gesture` goes on the panel; `guardPress(onPress)` wraps
 * the rows' presses so a touch that caught or dragged the panel presses nothing (natively the drag
 * cancels the row's touch itself, the web doesn't). The pager (`pagerGesture`) waits for it: a
 * sideways swipe fails it at once, a vertical drag holds the pager until it ends.
 */
export default function useDetailsPanelDrag(verticalDrag, pagerGesture) {
  const isPressBlocked = useRef(false);
  const blockPress = useCallback((isBlocked) => {
    isPressBlocked.current = isBlocked;
  }, []);

  // Memoized: a new config re-sends the gesture to native, and the panel re-renders as it's edited.
  const config = useMemo(
    () => ({
      activeOffsetY: [-TAP_SLOP, TAP_SLOP],
      failOffsetX: [-TAP_SLOP, TAP_SLOP],
      block: pagerGesture,
      onBegin: () => {
        'worklet';
        scheduleOnRN(blockPress, verticalDrag.grab());
      },
      onActivate: () => {
        'worklet';
        scheduleOnRN(blockPress, true);
        verticalDrag.onStart();
      },
      onUpdate: (event) => {
        'worklet';
        verticalDrag.onChange(event.changeY);
      },
      onDeactivate: (event) => {
        'worklet';
        verticalDrag.onEnd(event.velocityY);
      },
      onFinalize: () => {
        'worklet';
        verticalDrag.letGo();
      },
    }),
    [verticalDrag, pagerGesture, blockPress],
  );
  const gesture = usePanGesture(config);

  const guardPress = useCallback(
    (onPress) => () => {
      if (!isPressBlocked.current) onPress();
    },
    [],
  );

  return { gesture, guardPress };
}
