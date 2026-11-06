import { useEffect, useRef } from 'react';
import { Pressable, type PressableProps } from 'react-native';

export type SuperPressableProps = Omit<PressableProps, 'onPress' | 'onLongPress' | 'onPressOut'> & {
  onPress?: () => void;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onLongPressOut?: () => void;
};

// A pressable that also supports double press and long press. Every handler is optional.
export default function SuperPressable({
  onPress,
  onDoublePress,
  onLongPress,
  onLongPressOut,
  children,
  ...props
}: SuperPressableProps) {
  const lastPressRef = useRef(0);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress} onPressOut={handlePressOut} {...props}>
      {children}
    </Pressable>
  );
}
