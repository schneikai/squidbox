import { describe, expect, it } from 'vitest';

import { DONE_ONE_MISS, RUNNING, STOPPED, VISION_DONE } from './helpers/verifyRuns';
import verifySummary from '../src/features/model-verify/verifySummary';

describe('verifySummary', () => {
  it("says the latest run's state, when and how fast", () => {
    expect(verifySummary('writing', null)).toEqual({ title: 'Not verified yet', detail: null, icon: null });
    expect(verifySummary('writing', RUNNING)).toEqual({ title: 'Verifying… 5 of 9', detail: null, icon: 'running' });
    expect(verifySummary('writing', DONE_ONE_MISS)).toEqual({
      title: 'Passed 8 of 9',
      detail: 'just now · 1.8 s a reply',
      icon: 'missed',
    });
    expect(verifySummary('vision', VISION_DONE)).toEqual({
      title: 'Passed 4 of 4',
      detail: 'just now · 1.8 s a photo',
      icon: 'passed',
    });
  });

  it('says at which turn a stopped run stopped, or at which photo', () => {
    expect(verifySummary('writing', STOPPED)).toEqual({
      title: 'Verify stopped',
      detail: 'just now · at turn 8 of 9',
      icon: 'stopped',
    });
    expect(verifySummary('vision', { ...STOPPED, kind: 'vision', turnsDone: 2, turnsTotal: 4 }).detail).toBe(
      'just now · at photo 3 of 4',
    );
    // stopped after its last turn, before it was marked done
    expect(verifySummary('writing', { ...STOPPED, turnsDone: 9, turnsTotal: 9 }).detail).toBe(
      'just now · at turn 9 of 9',
    );
  });
});
