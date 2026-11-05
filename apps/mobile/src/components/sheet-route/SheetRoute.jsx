import { useNavigation } from 'expo-router';
import { useMemo } from 'react';
import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SheetRouteContext from './SheetRouteContext';

import ProgressOverlayHost from '@/components/progress-overlay/ProgressOverlayHost';
import QuickViewHost from '@/components/quick-view/QuickViewHost';

/**
 * Frames a route presented as a sheet (`presentation: 'modal'`), a one-screen sheet or a sheet
 * with its own stack (SheetStack), through its stack's `screenLayout`. Screens inside read it
 * with useSheetRoute: whether they are in a sheet, whether they are its first screen, how to close
 * the whole sheet, and its options (`setOptions({ gestureEnabled })` locks its swipe down).
 *
 * iOS presents the sheet as a page sheet whose own top safe-area inset is 0, so the sheet has its
 * own SafeAreaProvider: without it, screens read the window's inset (the notch) and leave a gap
 * below the sheet's top edge. The root's menus and progress overlay would show behind the sheet, so
 * it has its own MenuProvider and overlay hosts too (the quick view's, for peeks opened in the
 * sheet, and the progress overlay's, which shares the root's overlay state).
 */
export default function SheetRoute({ routeKey, children }) {
  const navigation = useNavigation();
  const sheet = useMemo(
    () => ({ routeKey, close: () => navigation.goBack(), setOptions: navigation.setOptions }),
    [routeKey, navigation],
  );

  return (
    <SheetRouteContext value={sheet}>
      <SafeAreaProvider>
        <MenuProvider skipInstanceCheck>{children}</MenuProvider>
        <QuickViewHost />
        <ProgressOverlayHost />
      </SafeAreaProvider>
    </SheetRouteContext>
  );
}
