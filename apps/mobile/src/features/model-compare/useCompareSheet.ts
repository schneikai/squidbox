import SheetRouteContext, { type SheetRouteValue } from '@/components/sheet-route/SheetRouteContext';
import useRequiredContext from '@/hooks/useRequiredContext';

/** The sheet the compare opens in (the (compare) group is a SheetStack): never shown outside one. */
export default function useCompareSheet(): SheetRouteValue {
  return useRequiredContext(SheetRouteContext, 'The compare opens in a sheet');
}
