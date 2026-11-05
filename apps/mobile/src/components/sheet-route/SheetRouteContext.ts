import type { NativeStackNavigationOptions } from 'expo-router';
import { createContext } from 'react';

// `setOptions` is the sheet's own navigation's (a native stack screen): `gestureEnabled: false`
// keeps it from being swiped away.
export type SheetRouteValue = {
  routeKey: string;
  close: () => void;
  setOptions: (options: Partial<NativeStackNavigationOptions>) => void;
};

// The sheet a screen is presented in (SheetRoute): `null` outside one.
const SheetRouteContext = createContext<SheetRouteValue | null>(null);

export default SheetRouteContext;
