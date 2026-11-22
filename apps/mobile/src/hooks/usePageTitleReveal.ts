import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import type { TitleReveal } from '@/components/floating-bars/useTitleReveal';
import useScrollY from '@/hooks/useScrollY';

/**
 * For a detail screen whose title is in the page (an album's name, a contact's): its header
 * (FloatingDetailHeader's `titleReveal`) shows the title once the page's own has scrolled under it.
 * Put `onTitleLayout` on the page's title, inside a view at the top of the content so its y doesn't
 * count the list's top padding, and `onScroll` on the list (or hand `scrollY` to a list that tracks
 * its own offset).
 */
export default function usePageTitleReveal() {
  const { onScroll, scrollY } = useScrollY();
  const [titleEnd, setTitleEnd] = useState(0);
  const titleReveal: TitleReveal = useMemo(() => ({ scrollY, from: titleEnd }), [scrollY, titleEnd]);

  function onTitleLayout(e: LayoutChangeEvent) {
    setTitleEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }

  return { onScroll, scrollY, titleReveal, onTitleLayout };
}
