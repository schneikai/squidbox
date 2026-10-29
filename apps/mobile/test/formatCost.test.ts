import { describe, expect, it } from 'vitest';

import formatCost from '../src/utils/ai/formatCost';

const writing = (usd: number) => formatCost({ costPerReplyUsd: usd, costPer100PhotosUsd: null }, 'writing');

describe('formatCost', () => {
  it('shows cents: whole from 10, one decimal from 1, else two, without trailing zeros', () => {
    expect(writing(0.0004)).toBe('0.04¢ a reply');
    expect(writing(0.001)).toBe('0.1¢ a reply');
    expect(writing(0.0123)).toBe('1.2¢ a reply');
    expect(writing(0.02)).toBe('2¢ a reply');
    expect(writing(0.1234)).toBe('12¢ a reply');
  });

  it('shows the cost of a photo for vision', () => {
    expect(formatCost({ costPerReplyUsd: 0.0004, costPer100PhotosUsd: 0.02 }, 'vision')).toBe('0.02¢ a photo');
  });
});
