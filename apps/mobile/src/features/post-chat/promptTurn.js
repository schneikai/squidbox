import { CHAT_LIMITS } from '@squidbox/shared';

/**
 * What a prompt button sends in the chat: its prompt, with its name over it in the bubble. With a
 * `caption` (a caption button in the editor), the prompt, a blank line and the caption, the caption
 * cut so the whole fits a chat message.
 */
export default function promptTurn(button, caption) {
  if (!caption) return { label: button.name, content: button.prompt };
  const head = `${button.prompt}\n\n`;
  return { label: button.name, content: head + caption.slice(0, Math.max(0, CHAT_LIMITS.message - head.length)) };
}
