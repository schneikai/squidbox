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

  it('reads a running run again every few seconds while a screen follows it', async () => {
    fetchRun.mockResolvedValue({ run: RUNNING, plan: WRITING_PLAN });
    const runs = verifyRunStore('writing', 'polls');

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchRun).toHaveBeenCalledTimes(2);
    unfollow();
  });

  it('stops reading once no screen follows it', async () => {
    fetchRun.mockResolvedValue({ run: RUNNING, plan: WRITING_PLAN });
    const runs = verifyRunStore('writing', 'unfollowed');

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    unfollow();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchRun).toHaveBeenCalledTimes(1);
  });

  it('keeps the run it has when a read fails', async () => {
    fetchRun.mockRejectedValueOnce(new Error('offline'));
    const runs = verifyRunStore('writing', 'keeps-run');
    runs.show({ run: RUNNING, plan: WRITING_PLAN });

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    unfollow();
    expect(runs.get().run).toBe(RUNNING);
  });

  it("reports a failed read's error", async () => {
    fetchRun.mockRejectedValueOnce(new Error('offline'));
    const runs = verifyRunStore('writing', 'reports');

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    unfollow();
    expect(runs.get().error).toBe('offline');
  });

  it('reads again after twice the poll when a read fails', async () => {
    fetchRun.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ run: RUNNING, plan: WRITING_PLAN });
    const runs = verifyRunStore('writing', 'backs-off');

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5999);
    expect(fetchRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchRun).toHaveBeenCalledTimes(2);
    unfollow();
  });

  it('clears the error once a read succeeds', async () => {
    fetchRun.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ run: RUNNING, plan: WRITING_PLAN });
    const runs = verifyRunStore('writing', 'recovers');

    const unfollow = runs.follow();
    await vi.advanceTimersByTimeAsync(6000);
    unfollow();
    expect(runs.get().error).toBeNull();
  });
});
