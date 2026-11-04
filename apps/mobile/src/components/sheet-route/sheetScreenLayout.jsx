import SheetRoute from './SheetRoute';

// A stack's `screenLayout` (called as a function): frames each screen it presents as a sheet
// (`presentation: 'modal'`) in SheetRoute.
export default function sheetScreenLayout({ route, options, children }) {
  if (options.presentation !== 'modal') return children;
  return <SheetRoute routeKey={route.key}>{children}</SheetRoute>;
}
