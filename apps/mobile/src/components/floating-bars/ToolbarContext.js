import { createContext } from 'react';

// True inside a toolbar (FloatingPill): there a tertiary icon button takes a full 44 pt slot, the
// spacing its bare icon doesn't have, so a toolbar's icons sit as far apart as its discs.
const ToolbarContext = createContext(false);

export default ToolbarContext;
