import { useRef } from 'react';

export default function useDebounce(fn, delay) {
  const timeoutIdRef = useRef(null);

  return function (...args) {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    timeoutIdRef.current = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
