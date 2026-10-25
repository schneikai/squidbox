import { describe, expect, it } from 'vitest';

import formatCost from '../src/features/model-compare/formatCost';

describe('formatCost', () => {
  it('shows cents: whole from 10, one decimal from 1, else two, without trailing zeros', () => {
    expect(formatCost(0.0004, 'writing')).toBe('0.04¢ a reply');
    expect(formatCost(0.001, 'writing')).toBe('0.1¢ a reply');
    expect(formatCost(0.0123, 'writing')).toBe('1.2¢ a reply');
    expect(formatCost(0.02, 'writing')).toBe('2¢ a reply');
    expect(formatCost(0.1234, 'writing')).toBe('12¢ a reply');
    expect(formatCost(0.02, 'vision')).toBe('2¢ per 100 photos');
  });
});
