import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import pageOverSheetLayout from '@/components/sheet-route/pageOverSheetLayout';
import { STACK_SCREEN_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

export type SheetStackProps = { children?: ReactNode };

/**
 * The layout of a sheet with steps (`app/(group)/_layout.tsx`): its screens push inside the sheet,
 * with Back, and never open behind it or as a second sheet. The photo screen is the one page that
 * shows over the whole sheet instead (PAGE_OVER_SHEET_OPTIONS). `children` are the stack's
 * `Stack.Screen`s that need options of their own.
 */
export default function SheetStack({ children }: SheetStackProps) {
  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS} screenLayout={pageOverSheetLayout}>
      {children}
    </Stack>
  );
}
