import { useMemo, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The safe-area insets for the asset screen's floating bars, with the top inset kept from while the
 * status bar shows. On an iPhone without a notch, hiding the status bar (fullscreen) takes its inset
 * away, which would move the bars while they fade.
 */
export default function useChromeInsets(isStatusBarHidden) {
  const insets = useSafeAreaInsets();
  const shownTopRef = useRef(insets.top);
  // Shown again, the status bar's inset comes back a moment after it.
  if (!isStatusBarHidden && insets.top > 0) shownTopRef.current = insets.top;
  const top = shownTopRef.current;

  return useMemo(() => ({ ...insets, top }), [insets, top]);
}
