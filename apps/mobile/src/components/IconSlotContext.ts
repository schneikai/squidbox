import { createContext } from 'react';

// True where a tertiary icon button takes a full 44 pt slot, the spacing its bare icon doesn't have,
// so a row's icons sit as far apart as its discs: in a toolbar (FloatingPill), in a picker's row.
const IconSlotContext = createContext(false);

export default IconSlotContext;
