import { useNavigation } from 'expo-router';
import { type ReactNode, useMemo } from 'react';

import ModalHosts from './ModalHosts';
import SheetRouteContext, { type SheetRouteValue } from './SheetRouteContext';

export type SheetRouteProps = { routeKey: string; children?: ReactNode };

/**
 * Frames a route presented as a sheet (`presentation: 'modal'`), a one-screen sheet or a sheet
 * with its own stack (SheetStack), through its stack's `screenLayout`. Screens inside read it
 * with useSheetRoute: whether they are in a sheet, whether they are its first screen, how to close
 * the whole sheet, and its options (`setOptions({ gestureEnabled })` locks its swipe down).
 *
 * iOS presents the sheet as a page sheet whose own top safe-area inset is 0, so the sheet has its
 * own hosts (ModalHosts): without its SafeAreaProvider, screens read the window's inset (the notch)
 * and leave a gap below the sheet's top edge.
 */
export default function SheetRoute({ routeKey, children }: SheetRouteProps) {
  const navigation = useNavigation();
  const sheet = useMemo<SheetRouteValue>(
    () => ({ routeKey, close: () => navigation.goBack(), setOptions: navigation.setOptions }),
    [routeKey, navigation],
  );

  return (
    <SheetRouteContext value={sheet}>
      <ModalHosts>{children}</ModalHosts>
    </SheetRouteContext>
  );
}
