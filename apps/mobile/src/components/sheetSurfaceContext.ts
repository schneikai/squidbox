import { createContext } from 'react';

/**
 * Whether what renders sits on a sheet's own white surface (BottomSheet's), where a card's shadow
 * would draw a second sheet: Section (a grouped list) leaves it out there.
 */
const sheetSurfaceContext = createContext(false);

export default sheetSurfaceContext;
