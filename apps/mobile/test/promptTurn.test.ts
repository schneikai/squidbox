import { CHAT_LIMITS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import promptTurn from '../src/features/post-chat/promptTurn';

const button = { name: 'Shorter', prompt: 'Make this shorter.' };

describe('promptTurn', () => {
  it("sends the prompt under the button's name", () => {
    expect(promptTurn(button)).toEqual({ label: 'Shorter', content: 'Make this shorter.' });
  });

  it('puts the caption under the prompt, after a blank line, cut to fit a chat message', () => {
    expect(promptTurn(button, 'Fog on the trail')).toEqual({
      label: 'Shorter',
      content: 'Make this shorter.\n\nFog on the trail',
    });
    const { content } = promptTurn(button, 'x'.repeat(CHAT_LIMITS.message));
    expect(content).toHaveLength(CHAT_LIMITS.message);
    expect(content.startsWith('Make this shorter.\n\nxxx')).toBe(true);
  });
});
