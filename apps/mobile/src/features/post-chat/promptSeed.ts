import type { NewPromptButton } from '@squidbox/shared';

import type { ChatSeed } from './chatSessions';

/** What a prompt button sends: its prompt, with its name over it in the bubble. */
export default function promptSeed(button: Pick<NewPromptButton, 'name' | 'prompt'>): Required<ChatSeed> {
  return { label: button.name, content: button.prompt };
}
