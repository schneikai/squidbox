import { useNavigation, useRoute } from 'expo-router';
import { use } from 'react';

import SheetRouteContext, { type SheetRouteValue } from '@/components/sheet-route/SheetRouteContext';

export type SheetRoute = Pick<SheetRouteValue, 'close' | 'setOptions'> & { isFirstScreen: boolean };

/**
 * The sheet this screen is presented in, or `null` outside one: `isFirstScreen` when the screen is
 * the sheet itself (a one-screen sheet, or the first screen of a sheet's stack) rather than a step
 * pushed inside it, `close()`, which closes the whole sheet from any of its screens, and
 * `setOptions(options)`, the sheet's own (`gestureEnabled: false` keeps it from being swiped away).
 */
export default function useSheetRoute(): SheetRoute | null {
  const sheet = use(SheetRouteContext);
  const navigation = useNavigation();
  const route = useRoute();
  if (!sheet) return null;
  // The sheet's route itself (a one-screen sheet), or the first screen of the sheet's stack. A
  // screen's place in its stack never changes: nothing below it goes while it stays.
  const isFirstScreen = route.key === sheet.routeKey || navigation.getState()?.routes[0]?.key === route.key;
  return { isFirstScreen, close: sheet.close, setOptions: sheet.setOptions };
}
