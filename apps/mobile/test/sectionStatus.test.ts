import { describe, expect, it } from 'vitest';

import { DONE_ONE_MISS, RUNNING, STOPPED, WRITING_PLAN } from './helpers/verifyRuns';
import sectionStatus from '../src/features/model-verify/sectionStatus';

const statuses = (run: Parameters<typeof sectionStatus>[2]) =>
  WRITING_PLAN.sections.map((_, index) => sectionStatus(WRITING_PLAN, index, run));

describe('sectionStatus', () => {
  it('shows a running run: done, running so far, waiting', () => {
    expect(statuses(RUNNING)).toEqual([
      { icon: 'passed', text: '4 of 4 passed' },
      { icon: 'running', text: '1 of 2 so far, all passed' },
      { icon: 'waiting', text: '3 turns' },
    ]);
  });

  it('shows the first section running before its first turn', () => {
    const starting = { ...RUNNING, turnsDone: 0, result: null };
    expect(statuses(starting)).toEqual([
      { icon: 'running', text: '4 turns' },
      { icon: 'waiting', text: '2 turns' },
      { icon: 'waiting', text: '3 turns' },
    ]);
  });

  it('shows a done run with a miss', () => {
    expect(statuses(DONE_ONE_MISS)).toEqual([
      { icon: 'passed', text: '4 of 4 passed' },
      { icon: 'missed', text: '1 of 2 passed' },
      { icon: 'passed', text: '3 of 3 passed' },
    ]);
  });

  it('shows where a stopped run stopped, and the rest not reached', () => {
    expect(statuses(STOPPED)).toEqual([
      { icon: 'passed', text: '4 of 4 passed' },
      { icon: 'passed', text: '2 of 2 passed' },
      { icon: 'stopped', text: '1 of 3, then no answer' },
    ]);
    const early = { ...STOPPED, result: { ...STOPPED.result!, sections: STOPPED.result!.sections.slice(0, 1) } };
    expect(statuses(early).slice(1)).toEqual([
      { icon: 'stopped', text: 'No answer' },
      { icon: 'waiting', text: 'Not reached' },
    ]);
  });
});
