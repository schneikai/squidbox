import { createContext } from 'react';

// Set by an AssistantTray around what it holds, null elsewhere: `inset` is what the tray's row keeps
// from its edges (PromptButtonRow, the ideas' carousel).
const AssistantTrayContext = createContext<{ inset: number } | null>(null);

export default AssistantTrayContext;
