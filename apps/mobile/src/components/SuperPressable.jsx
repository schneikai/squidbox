import { useRef } from 'react';
import { Pressable } from 'react-native';

// A pressable that also supports double press and long press. Every handler is optional.

export default function SuperPressable({ onPress, onDoublePress, onLongPress, onLongPressOut, children, ...props }) {
  const lastPressRef = useRef(0);
  const timeoutIdRef = useRef(null);
  const isLongPressRef = useRef(false);

  function handlePress() {
    if (!onDoublePress) return onPress?.(); // no need to wait for a second tap
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastPressRef.current < DOUBLE_PRESS_DELAY) {
      clearTimeout(timeoutIdRef.current);
      onDoublePress();
    } else {
      timeoutIdRef.current = setTimeout(() => {
        onPress?.();
      }, DOUBLE_PRESS_DELAY);
    }

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

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress} onPressOut={handlePressOut} {...props}>
      {children}
    </Pressable>
  );
}
