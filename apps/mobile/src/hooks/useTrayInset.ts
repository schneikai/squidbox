import { useContext } from 'react';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import { SCREEN_PADDING } from '@/constants';

/**
 * What a row that scrolls sideways keeps from its edges: `inset` when given, else the AssistantTray's
 * it sits in, else the screen's padding.
 */
export default function useTrayInset(inset?: number): number {
  const tray = useContext(AssistantTrayContext);
  return inset ?? tray?.inset ?? SCREEN_PADDING;
}
