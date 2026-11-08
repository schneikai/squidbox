import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';

/**
 * A list's `header`, scrolling with its cells above them: `headerView` measures it (the same element
 * while `header` is), and `cellsTop` is where the cells start, `paddingTop` plus its height, for what
 * finds a cell by its offset (drag select, reorder, the mounted window).
 */
export default function useScrollingHeader(header: ReactNode, paddingTop: number) {
  const [height, setHeight] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height), []);
  const headerView = useMemo(
    () => (header ? <View onLayout={handleLayout}>{header}</View> : undefined),
    [header, handleLayout],
  );
  return { headerView, cellsTop: paddingTop + (header ? height : 0) };
}
