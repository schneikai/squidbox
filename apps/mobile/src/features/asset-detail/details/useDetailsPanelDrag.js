import { useCallback, useRef } from 'react';
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

  const gesture = usePanGesture({
    activeOffsetY: [-TAP_SLOP, TAP_SLOP],
    failOffsetX: [-TAP_SLOP, TAP_SLOP],
    block: pagerGesture,
    onBegin: () => {
      scheduleOnRN(blockPress, verticalDrag.grab());
    },
    onActivate: () => {
      scheduleOnRN(blockPress, true);
      verticalDrag.onStart();
    },
    onUpdate: (event) => {
      verticalDrag.onChange(event.changeY);
    },
    onDeactivate: (event) => {
      verticalDrag.onEnd(event.velocityY);
    },
    onFinalize: () => {
      verticalDrag.letGo();
    },
  });

  const guardPress = useCallback(
    (onPress) => () => {
      if (!isPressBlocked.current) onPress();
    },
    [],
  );

  return { gesture, guardPress };
}
