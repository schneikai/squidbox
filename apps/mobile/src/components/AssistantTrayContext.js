import { createContext } from 'react';

// Inside an AssistantTray: the inset its row's chips keep from the tray's edges (PromptButtonRow's
// default), and a sign for what sits on it to take the accent (EditPromptButtonsButton). Null
// elsewhere.
const AssistantTrayContext = createContext(null);

export default AssistantTrayContext;
