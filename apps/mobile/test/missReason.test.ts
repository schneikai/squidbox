import { describe, expect, it } from 'vitest';

import { missedTurn, passedTurn } from './helpers/verifyRuns';
import missReason from '../src/features/model-verify/missReason';

describe('missReason', () => {
  it('says why the turn got no answer before any check', () => {
    expect(missReason({ ...missedTurn(), error: 'Venice timed out' })).toBe('Venice timed out');
  });

  it("prefers the judge's reason to an earlier failed check's", () => {
    expect(missReason(missedTurn('ignored the tone'))).toBe('ignored the tone');
  });

  it('says a check failed when the failed check gives no reason', () => {
    expect(missReason({ ...passedTurn(), checks: [{ name: 'cards:3', ok: false, reason: null }] })).toBe(
      'a check failed',
    );
  });

  it('is null for a turn that passed', () => {
    expect(missReason(passedTurn())).toBeNull();
  });
});
