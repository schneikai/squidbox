import { describe, expect, it } from 'vitest';

import { missedTurn, passedTurn } from './helpers/verifyRuns';
import turnStatus from '../src/features/model-verify/turnStatus';

describe('turnStatus', () => {
  it('reads a turn in as passed or missed, else running or waiting', () => {
    expect(turnStatus(passedTurn(), false)).toBe('passed');
    expect(turnStatus(missedTurn(), true)).toBe('missed');
    expect(turnStatus(null, true)).toBe('running');
    expect(turnStatus(null, false)).toBe('waiting');
  });
});
