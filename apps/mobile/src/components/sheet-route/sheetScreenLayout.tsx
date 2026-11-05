import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import SheetRoute from './SheetRoute';

type ScreenLayoutProps = Parameters<NonNullable<ComponentProps<typeof Stack>['screenLayout']>>[0];

// A stack's `screenLayout` (called as a function): frames each screen it presents as a sheet
// (`presentation: 'modal'`) in SheetRoute.
export default function sheetScreenLayout({ route, options, children }: ScreenLayoutProps) {
  if (options.presentation !== 'modal') return children;
  return <SheetRoute routeKey={route.key}>{children}</SheetRoute>;
}
