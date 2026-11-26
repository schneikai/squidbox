import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import ModalHosts from './ModalHosts';
import SheetRouteContext from './SheetRouteContext';

type ScreenLayoutProps = Parameters<NonNullable<ComponentProps<typeof Stack>['screenLayout']>>[0];

// A sheet stack's `screenLayout` (called as a function): a screen it presents as a page over the
// sheet (PAGE_OVER_SHEET_OPTIONS) is out of the sheet, a page like the main app's, with its own
// hosts (ModalHosts) for the whole screen.
export default function pageOverSheetLayout({ options, children }: ScreenLayoutProps) {
  if (options.presentation !== 'fullScreenModal') return children;
  return (
    <SheetRouteContext value={null}>
      <ModalHosts>{children}</ModalHosts>
    </SheetRouteContext>
  );
}
