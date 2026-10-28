import { describe, expect, it } from 'vitest';

import checkCostText from '../src/features/model-verify/checkCostText';

const model = (costPerReplyUsd: number, costPer100PhotosUsd: number | null = null) => ({
  costPerReplyUsd,
  costPer100PhotosUsd,
});

describe('checkCostText', () => {
  it("adds the judge's replies to a writing run's, in cents below a dollar", () => {
    // 21 × (0.004 + 0.006) = 0.21
    expect(checkCostText('writing', model(0.004), model(0.006))).toBe('21¢');
    expect(checkCostText('writing', model(0.0001), null)).toBe('0.21¢');
  });

  it('shows a dollar and more in dollars', () => {
    expect(checkCostText('writing', model(0.03), model(0.027143))).toBe('$1.20');
  });

  it('costs a vision run four photos', () => {
    // 4 × 0.5 / 100 = 0.02
    expect(checkCostText('vision', model(0, 0.5))).toBe('2¢');
  });
});
