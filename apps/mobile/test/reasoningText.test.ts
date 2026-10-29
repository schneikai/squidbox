import { describe, expect, it } from 'vitest';

import reasoningText from '../src/utils/ai/reasoningText';

describe('reasoningText', () => {
  it('says whether the model reasons, and its default effort when Venice names one', () => {
    expect(reasoningText({ reasoning: { supported: false, defaultEffort: null } })).toBe('no reasoning');
    expect(reasoningText({ reasoning: { supported: true, defaultEffort: null } })).toBe('reasons');
    expect(reasoningText({ reasoning: { supported: true, defaultEffort: 'high' } })).toBe('reasons · effort high');
    // a server deployed before `reasoning`
    expect(reasoningText({})).toBeNull();
  });
});
