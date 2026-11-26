import type { ReactNode } from 'react';
import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProgressOverlayHost from '@/components/progress-overlay/ProgressOverlayHost';
import QuickViewHost from '@/components/quick-view/QuickViewHost';

export type ModalHostsProps = { children?: ReactNode };

/**
 * What a route iOS presents over the others (a sheet, or a page over a sheet) needs of its own: its
 * own SafeAreaProvider, so its screens read its insets, not the window's or the sheet's under it,
 * and its own MenuProvider and overlay hosts (the quick view's, for peeks opened in it, and the
 * progress overlay's, which shares the root's overlay state), which would show behind it otherwise.
 */
export default function ModalHosts({ children }: ModalHostsProps) {
  return (
    <SafeAreaProvider>
      <MenuProvider skipInstanceCheck>{children}</MenuProvider>
      <QuickViewHost />
      <ProgressOverlayHost />
    </SafeAreaProvider>
  );
}
