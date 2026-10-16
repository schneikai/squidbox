import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// Whether the system's Reduce Motion setting is on, following changes to it. Reanimated's
// useReducedMotion is the setting at app start only; it seeds the state, so the first render is
// right without waiting for the async query.
export default function useReduceMotion() {
  const atStart = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(atStart);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => mounted && setReduceMotion(enabled));
    const unsubscribe = subscribe(setReduceMotion);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return reduceMotion;
}

// One system subscription for every user: react-native-web files listeners under their source text,
// so removing one of two would remove the other.
const listeners = new Set();
let subscription = null;

function subscribe(listener) {
  listeners.add(listener);
  subscription ??= AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) =>
    listeners.forEach((each) => each(enabled)),
  );
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    subscription.remove();
    subscription = null;
  };
}
