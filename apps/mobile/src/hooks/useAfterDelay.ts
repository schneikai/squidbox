import { useEffect, useState } from 'react';

/** Whether `active` has held for `ms`: false again as soon as it stops. */
export default function useAfterDelay(active: boolean, ms: number): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setPassed(true), ms);
    return () => {
      clearTimeout(timer);
      setPassed(false);
    };
  }, [active, ms]);

  return active && passed;
}
