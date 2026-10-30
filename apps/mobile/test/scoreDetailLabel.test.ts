import { describe, expect, it } from 'vitest';

import scoreDetailLabel from '../src/utils/ai/scoreDetailLabel';

describe('scoreDetailLabel', () => {
  it('says the thumbs up before the line while there are any', () => {
    expect(scoreDetailLabel(9, 'reasons · 0.04¢ a reply')).toBe('9 thumbs up · reasons · 0.04¢ a reply');
    expect(scoreDetailLabel(1, '0.02¢ a photo')).toBe('1 thumb up · 0.02¢ a photo');
  });

  it('leaves the line as it reads without a score', () => {
    expect(scoreDetailLabel(0, '0.04¢ a reply')).toBeUndefined();
    expect(scoreDetailLabel(null, '0.04¢ a reply')).toBeUndefined();
    expect(scoreDetailLabel(undefined, '0.04¢ a reply')).toBeUndefined();
  });
});
