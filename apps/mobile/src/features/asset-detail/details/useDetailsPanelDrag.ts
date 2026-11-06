import { useCallback, useMemo, useRef } from 'react';
import { usePanGesture, type NativeGesture, type PanGestureConfig } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import type { VerticalDrag } from './useDetailsPanel';

import { TAP_SLOP } from '@/constants';
import type { GuardPress } from '@/lib/unguarded';

/**
 * The details panel's own drag, on the same track as the photo's (`verticalDrag`, useDetailsPanel):
 * a vertical drag anywhere on the panel scrolls the details and, from their top, closes it, and a
 * touch on the moving panel catches it. `gesture` goes on the panel; `guardPress(onPress)` wraps
 * the rows' presses so a touch that caught or dragged the panel presses nothing (natively the drag
 * cancels the row's touch itself, the web doesn't). The pager (`pagerGesture`) waits for it: a
 * sideways swipe fails it at once, a vertical drag holds the pager until it ends.
 */
export default function useDetailsPanelDrag(
  verticalDrag: Pick<VerticalDrag, 'grab' | 'letGo' | 'onStart' | 'onChange' | 'onEnd'>,
  pagerGesture: NativeGesture,
) {
  const isPressBlocked = useRef(false);
  const blockPress = useCallback((isBlocked: boolean) => {
    isPressBlocked.current = isBlocked;
  }, []);

  // Memoized: a new config re-sends the gesture to native, and the panel re-renders as it's edited.
  const config = useMemo<PanGestureConfig>(
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

  const guardPress = useCallback<GuardPress>(
    (onPress) => () => {
      if (!isPressBlocked.current) onPress();
    },
    [],
  );

  return { gesture, guardPress };
}
