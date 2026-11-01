import SheetRoute from './SheetRoute';

// The `layout` of a one-screen sheet's `Stack.Screen`. Expo Router's Stack calls a layout as a
// function, so it renders SheetRoute as an element rather than being SheetRoute itself.
export default function sheetLayout({ children }) {
  return <SheetRoute>{children}</SheetRoute>;
}
