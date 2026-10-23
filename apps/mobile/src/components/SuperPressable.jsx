import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';

// A pressable that also supports double press and long press. Every handler is optional.

export default function SuperPressable({ onPress, onDoublePress, onLongPress, onLongPressOut, children, ...props }) {
  const lastPressRef = useRef(0);
  const timeoutIdRef = useRef(null);
  const isLongPressRef = useRef(false);

  useEffect(() => () => clearTimeout(timeoutIdRef.current), []);

  function handlePress() {
    if (!onDoublePress) return onPress?.(); // no need to wait for a second tap
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastPressRef.current < DOUBLE_PRESS_DELAY) {
      clearTimeout(timeoutIdRef.current);
      lastPressRef.current = 0; // a third tap starts over instead of making a second double press
      onDoublePress();
      return;
    }

    timeoutIdRef.current = setTimeout(() => {
      onPress?.();
    }, DOUBLE_PRESS_DELAY);
    lastPressRef.current = now;
  }

  function handleLongPress() {
    clearTimeout(timeoutIdRef.current);
    onLongPress?.();
    isLongPressRef.current = true;
  }

  function handlePressOut() {
    if (isLongPressRef.current) {
      onLongPressOut?.();
      isLongPressRef.current = false;
    }
  }

  // With a hold gesture, not focusable by a click (web): react-native-web ends a press when its element
  // loses focus, and what a hold opens (a Modal) takes focus. Keyboards can't long-press anyway. No
  // effect on native.
  const tabIndex = onLongPress ? null : undefined;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      tabIndex={tabIndex}
      {...props}
    >
      {children}
    </Pressable>
  );
}
