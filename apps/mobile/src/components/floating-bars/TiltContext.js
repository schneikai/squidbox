import { createContext } from 'react';

// The phone's tilt for floating UI (TiltProvider): `{ x, y }` shared values, -1…1. Null outside it.
export default createContext(null);
