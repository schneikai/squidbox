import { resolveModelId, type ModelDefaults } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

// The server's model_defaults, as the catalog brings them.
const defaults: ModelDefaults = {
  writing: { regular: 'claude-sonnet-5-5', unrestricted: 'deepseek-v4-1-flash-uncensored' },
  vision: { regular: 'gemma-4-uncensored', unrestricted: 'qwen-3-6-plus' },
};

// The model useYourModels shows as chosen (and the server's readChosenModelId uses).
describe('resolveModelId', () => {
  it('defaults to the regular model, and to the unrestricted one with Adult content on', () => {
    expect(resolveModelId('writing', null, false, defaults)).toBe('claude-sonnet-5-5');
    expect(resolveModelId('writing', null, undefined, defaults)).toBe('claude-sonnet-5-5');
    expect(resolveModelId('writing', null, true, defaults)).toBe('deepseek-v4-1-flash-uncensored');
    expect(resolveModelId('vision', null, false, defaults)).toBe('gemma-4-uncensored');
    expect(resolveModelId('vision', null, true, defaults)).toBe('qwen-3-6-plus');
  });

  it("uses the user's own choice whatever the switch says", () => {
    const chosen = { id: 'kimi-k3', name: 'Kimi K3' };
    expect(resolveModelId('writing', chosen, true, defaults)).toBe('kimi-k3');
    expect(resolveModelId('writing', chosen, false, defaults)).toBe('kimi-k3');
  });
});
