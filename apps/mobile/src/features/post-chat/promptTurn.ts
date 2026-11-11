import type { NewPromptButton } from '@squidbox/shared';

import type { UserTurn } from './chatSessions';

/** What a prompt button tapped on the tray sends for the post `target`: its prompt, with its name over it in the bubble. */
export default function promptTurn(button: Pick<NewPromptButton, 'name' | 'prompt'>, target: string): UserTurn {
  return { label: button.name, content: button.prompt, kind: 'prompt', target };
}
