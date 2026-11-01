import { createContext } from 'react';

// The sheet a screen is presented in (SheetRoute): `null` outside one.
const SheetRouteContext = createContext(null);

export default SheetRouteContext;
