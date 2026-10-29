import { describe, expect, it } from 'vitest';

import { missedTurn, passedTurn } from './helpers/verifyRuns';
import countPassed from '../src/features/model-verify/countPassed';

describe('countPassed', () => {
  it('counts the turns with an answer whose every check passed', () => {
    const noAnswer = { ...passedTurn(), reply: null, checks: [], error: 'The model refused: No.' };
    expect(countPassed([passedTurn(), missedTurn(), noAnswer, passedTurn()])).toBe(2);
    expect(countPassed([])).toBe(0);
  });
});
