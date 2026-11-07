import SheetRouteContext, { type SheetRouteValue } from '@/components/sheet-route/SheetRouteContext';
import useRequiredContext from '@/hooks/useRequiredContext';

/** The sheet a screen that only ever opens in one (a SheetStack's group) is presented in: throws outside one. */
export default function useRequiredSheetRoute(): SheetRouteValue {
  return useRequiredContext(SheetRouteContext, 'This screen opens only in a sheet');
}
