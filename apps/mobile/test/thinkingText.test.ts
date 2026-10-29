import { describe, expect, it } from 'vitest';

import thinkingText from '../src/utils/ai/thinkingText';

describe('thinkingText', () => {
  it("says how the model thinks, from Venice's reasoning capabilities", () => {
    expect(thinkingText({ reasoning: { supported: false, defaultEffort: null } })).toBe('no thinking');
    expect(thinkingText({ reasoning: { supported: true, defaultEffort: null } })).toBe('thinks');
    expect(thinkingText({ reasoning: { supported: true, defaultEffort: 'high' } })).toBe('effort high');
  });
});
