import { describe, expect, it } from 'vitest';

import verifyCostText from '../src/features/model-verify/verifyCostText';

const model = (costPerReplyUsd: number, costPer100PhotosUsd: number | null = null) => ({
  costPerReplyUsd,
  costPer100PhotosUsd,
});

describe('verifyCostText', () => {
  it("adds the judge's replies to a writing run's, in cents below a dollar", () => {
    // 21 × (0.004 + 0.006) = 0.21
    expect(verifyCostText('writing', model(0.004), model(0.006))).toBe('about 21¢');
    // 21 × (0.0004 + 0.004) = 0.0924
    expect(verifyCostText('writing', model(0.0004), model(0.004))).toBe('about 9.2¢');
  });

  it('says under 1¢ for less, and dollars from one up', () => {
    expect(verifyCostText('writing', model(0.0001), null)).toBe('under 1¢');
    expect(verifyCostText('writing', model(0.03), model(0.027143))).toBe('about $1.20');
  });

  it('costs a vision run four photos', () => {
    // 4 × 0.5 / 100 = 0.02
    expect(verifyCostText('vision', model(0, 0.5))).toBe('about 2¢');
  });
});
