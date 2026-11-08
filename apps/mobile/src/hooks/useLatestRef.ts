import { type RefObject, useEffect, useRef } from 'react';

/**
 * A ref that holds `value` as of the last render, for a callback that reads it when it runs rather
 * than when it was made: the callback keeps its identity while the value changes.
 */
export default function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
