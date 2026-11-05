import { useEffect } from 'react';

// react-native-web's ScrollView fires neither end event, so the pager's resting place is read from
// the DOM's own `scrollend` on `listRef`'s scroll node, which fires once the scroll snap has settled:
// `onSettle(scrollLeft)`.
export default function usePagerScrollEnd(listRef, onSettle) {
  useEffect(() => {
    const node = listRef.current?.getScrollableNode?.();
    if (!node) return;
    const handleScrollEnd = () => onSettle(node.scrollLeft);
    node.addEventListener('scrollend', handleScrollEnd);
    return () => node.removeEventListener('scrollend', handleScrollEnd);
  }, [listRef, onSettle]);
}
