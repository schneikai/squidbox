import { createContext } from 'react';

// Set by an AssistantTray around what it holds, null elsewhere: on a tray the pen is a light violet
// disc (EditPromptButtonsButton), and `inset` is what the tray's row keeps from its edges
// (PromptButtonRow).
const AssistantTrayContext = createContext(null);

export default AssistantTrayContext;
