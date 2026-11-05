import { useEffect, useRef } from 'react';

import { PEEK_AFTER_LIFT_MS } from '@/constants';

/**
 * The peek of a grid's lifted cell (useDragReorder, useDragSelect): `schedule(row)` on the lift
 * peeks at it (`onPeek(row)`) once it was held still for PEEK_AFTER_LIFT_MS, `end()` on moving on or
 * on release cancels the wait or ends the peek (`onPeekEnd()`). `isPeeking()` says whether it peeks.
 * Without `onPeek` (`canPeek` false) nothing peeks.
 */
export default function usePeekAfterLift<Row>({
  onPeek,
  onPeekEnd,
}: {
  onPeek?: (row: Row) => void;
  onPeekEnd?: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPeekingRef = useRef(false);
  // Called after a timer, so read when they run.
  const callbacks = useRef({ onPeek, onPeekEnd });
  callbacks.current.onPeek = onPeek;
  callbacks.current.onPeekEnd = onPeekEnd;
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return {
    canPeek: Boolean(onPeek),
    isPeeking: () => isPeekingRef.current,
    schedule(row: Row) {
      timerRef.current = setTimeout(() => {
        isPeekingRef.current = true;
        callbacks.current.onPeek?.(row);
      }, PEEK_AFTER_LIFT_MS);
    },
    end() {
      clearTimeout(timerRef.current);
      if (!isPeekingRef.current) return;
      isPeekingRef.current = false;
      callbacks.current.onPeekEnd?.();
    },
  };
}
