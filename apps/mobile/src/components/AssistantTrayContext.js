import { createContext } from 'react';

// Set by an AssistantTray around what it holds, null elsewhere: being on a tray turns the pen to the
// accent (EditPromptButtonsButton), and `inset` is what the tray's row keeps from its edges
// (PromptButtonRow).
const AssistantTrayContext = createContext(null);

export default AssistantTrayContext;
