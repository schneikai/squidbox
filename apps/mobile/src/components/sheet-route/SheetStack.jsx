import { Stack } from 'expo-router';

import { STACK_SCREEN_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

/**
 * The layout of a sheet with steps (`app/(group)/_layout.jsx`): its screens push inside the sheet,
 * with Back, and never open behind it or as a second sheet. `children` are the stack's
 * `Stack.Screen`s that need options of their own.
 */
export default function SheetStack({ children }) {
  return <Stack screenOptions={STACK_SCREEN_OPTIONS}>{children}</Stack>;
}
