import { describe, expect, it } from 'vitest';

import promptTurn from '../src/features/post-chat/promptTurn';

describe('promptTurn', () => {
  it("sends the button's prompt as the message, with its name over it", () => {
    expect(promptTurn({ name: 'Shorter', prompt: 'Make it shorter' })).toEqual({
      label: 'Shorter',
      content: 'Make it shorter',
    });
  });
});
