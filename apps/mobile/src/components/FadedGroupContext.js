import { createContext } from 'react';

// True inside a surface that fades as a whole while its button is off (a toolbar that is only the
// primary button, FloatingPill), so the Button inside doesn't fade a second time.
const FadedGroupContext = createContext(false);

export default FadedGroupContext;
