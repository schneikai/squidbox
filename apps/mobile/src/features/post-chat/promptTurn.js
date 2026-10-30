/** What a prompt button sends in the chat: its prompt, with its name over it in the bubble. */
export default function promptTurn(button) {
  return { label: button.name, content: button.prompt };
}
