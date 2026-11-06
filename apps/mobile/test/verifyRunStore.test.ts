import type { AiModelKind, VerifyRunResponse } from '@squidbox/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { passedTurn, RUNNING, WRITING_PLAN } from './helpers/verifyRuns';

const fetchRun = vi.fn<(kind: AiModelKind, modelId: string) => Promise<VerifyRunResponse>>();
vi.mock('@/utils/cloud-api/ai/fetchVerifyRunAsync', () => ({ default: fetchRun }));

const { default: verifyRunStore } = await import('../src/features/model-verify/verifyRunStore');

// One store per kind and model for the module's life: each test follows a model of its own.
describe('verifyRunStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the turns it already had when a poll brings more', async () => {
    const runs = verifyRunStore('writing', 'keeps-turns');
    runs.show({ run: RUNNING, plan: WRITING_PLAN });
    const [talk, refine] = RUNNING.result!.sections;
    const polled = {
      ...RUNNING,
      turnsDone: 6,
      result: {
        ...RUNNING.result!,
        sections: [
          { ...talk, turns: talk.turns.map(() => passedTurn()) },
          { ...refine, turns: [passedTurn(), passedTurn()] },
        ],
      },
    };
    fetchRun.mockResolvedValue({ run: polled, plan: WRITING_PLAN });

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    unfollow();

    const sections = runs.get().run!.result!.sections;
    expect(sections[0].turns[0]).toBe(talk.turns[0]);
    expect(sections[1].turns).toHaveLength(2);
    expect(sections[1].turns[0]).toBe(refine.turns[0]);
  });

  it('reads a running run again every few seconds while a screen follows it, and stops when none does', async () => {
    fetchRun.mockResolvedValue({ run: RUNNING, plan: WRITING_PLAN });
    const runs = verifyRunStore('writing', 'polls');

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchRun).toHaveBeenCalledTimes(2);

    unfollow();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchRun).toHaveBeenCalledTimes(2);
  });

  it('keeps what it has and reports a failed read, then reads again', async () => {
    fetchRun.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ run: RUNNING, plan: WRITING_PLAN });
    const runs = verifyRunStore('writing', 'fails-once');
    runs.show({ run: RUNNING, plan: WRITING_PLAN });

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    expect(runs.get()).toEqual({ run: RUNNING, plan: WRITING_PLAN, error: 'offline' });
    expect(runs.get().run).toBe(RUNNING);

    // Slower after a failure: twice the poll.
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchRun).toHaveBeenCalledTimes(2);
    expect(runs.get().error).toBeNull();
    unfollow();
  });
});
