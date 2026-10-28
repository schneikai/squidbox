import { resolveModelId } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

// The model useYourModels shows as chosen (and the server's readChosenModelId uses).
describe('resolveModelId', () => {
  it('defaults writing to a regular model, and to an unrestricted one with Adult content on', () => {
    expect(resolveModelId('writing', null, false)).toBe('claude-sonnet-5-5');
    expect(resolveModelId('writing', null, undefined)).toBe('claude-sonnet-5-5');
    expect(resolveModelId('writing', null, true)).toBe('deepseek-v4-1-flash-uncensored');
  });

  it('keeps the vision default either way', () => {
    expect(resolveModelId('vision', null, false)).toBe('gemma-4-uncensored');
    expect(resolveModelId('vision', null, true)).toBe('gemma-4-uncensored');
  });

  it("uses the user's own choice whatever the switch says", () => {
    const chosen = { id: 'kimi-k3', name: 'Kimi K3' };
    expect(resolveModelId('writing', chosen, true)).toBe('kimi-k3');
    expect(resolveModelId('writing', chosen, false)).toBe('kimi-k3');
  });
});
