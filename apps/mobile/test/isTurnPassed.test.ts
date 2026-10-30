import { describe, expect, it } from 'vitest';

import { missedTurn, passedTurn } from './helpers/verifyRuns';
import isTurnPassed from '../src/features/model-verify/isTurnPassed';

describe('isTurnPassed', () => {
  it('passes a turn with an answer whose every check passed', () => {
    const noAnswer = { ...passedTurn(), reply: null, checks: [], error: 'The model refused: No.' };
    expect(isTurnPassed(passedTurn())).toBe(true);
    expect(isTurnPassed(missedTurn())).toBe(false);
    expect(isTurnPassed(noAnswer)).toBe(false);
  });
});
