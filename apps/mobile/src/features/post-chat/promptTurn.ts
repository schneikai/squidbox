import type { NewPromptButton } from '@squidbox/shared';

/** What a prompt button sends in the chat: its prompt, with its name over it in the bubble. */
export default function promptTurn(button: Pick<NewPromptButton, 'name' | 'prompt'>) {
  return { label: button.name, content: button.prompt };
}
