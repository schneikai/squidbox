import { describe, expect, it } from 'vitest';

import scoreText from '../src/features/model-compare/scoreText';

describe('scoreText', () => {
  it('is the thumbs up for writing and the tags that fit for vision', () => {
    expect(scoreText(null, 'writing')).toBe('Not tried yet');
    expect(scoreText(undefined, 'vision')).toBe('Not tried yet');
    expect(scoreText(0, 'writing')).toBe('0');
    expect(scoreText(0, 'vision')).toBe('0 tags fit');
    expect(scoreText(9, 'writing')).toBe('9');
    expect(scoreText(34, 'vision')).toBe('34 tags fit');
    expect(scoreText(1, 'vision')).toBe('1 tag fits');
  });
});
