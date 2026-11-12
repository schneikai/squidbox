import type { RefObject } from 'react';

// Natively the list's own end events report where it came to rest (AssetPager); the web needs this
// hook (usePagerScrollEnd.web.ts).
export default function usePagerScrollEnd(_listRef: RefObject<unknown>, _onSettle: (x: number) => void) {}
