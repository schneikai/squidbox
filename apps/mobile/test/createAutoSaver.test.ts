import { describe, expect, it, vi } from 'vitest';

import createAutoSaver from '../src/utils/createAutoSaver';

type Value = Record<string, string>;
type Save = (next: Value, stored: Value) => Promise<unknown>;

function makeSaver(value: Value, save: Save) {
  const onError = vi.fn();
  const sync = vi.fn();
  const saver = createAutoSaver({ value, save: vi.fn(save), onError, sync, delayMs: 10 });
  return { saver, onError, sync };
}

describe('createAutoSaver', () => {
  it('saves once changes pause, and not what is stored already', async () => {
    vi.useFakeTimers();
    try {
      const save = vi.fn(async () => true);
      const { saver } = makeSaver({ text: 'a' }, save);
      saver.change({ text: 'ab' });
      saver.change({ text: 'abc' });
      await vi.advanceTimersByTimeAsync(20);
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toEqual({ text: 'abc' });
      await saver.flush();
      expect(save).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a failed save, stores nothing, and syncs only what was stored', async () => {
    let fails = true;
    const { saver, onError, sync } = makeSaver({ text: 'a' }, async () => {
      if (fails) throw new Error('disk full');
      return true;
    });
    saver.change({ text: 'b' });
    await saver.flush({ shouldSync: true });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
    fails = false;
    await saver.flush({ shouldSync: true });
    expect(sync).toHaveBeenCalledTimes(1);
    await saver.flush({ shouldSync: true });
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
