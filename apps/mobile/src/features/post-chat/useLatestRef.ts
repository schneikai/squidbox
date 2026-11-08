import { type RefObject, useRef } from 'react';

/**
 * A ref that holds `value` as of the latest render, for a callback that reads it when it runs rather
 * than when it was made: the callback keeps its identity while the value changes.
 */
export default function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
