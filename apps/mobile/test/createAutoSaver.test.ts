import { describe, expect, it, vi } from 'vitest';

import createAutoSaver from '../src/utils/createAutoSaver';

type Value = Record<string, string>;
type Save = (next: Value, stored: Value, options: { isLeaving: boolean }) => Promise<unknown>;

function makeSaver(value: Value, save: Save) {
  const onError = vi.fn();
  const sync = vi.fn();
  const saver = createAutoSaver({ value, save: vi.fn(save), onError, sync, delayMs: 10 });
  return { saver, onError, sync };
}

describe('createAutoSaver', () => {
  it('gives the next save what a partial save stored, so a field changed back is written', async () => {
    const calls: [Value, Value][] = [];
    const { saver } = makeSaver({ name: 'A', icon: 'x' }, async (next, stored) => {
      calls.push([next, stored]);
      // The emptied name isn't written, the icon is.
      return { ...stored, icon: next.icon };
    });
    saver.change({ name: '', icon: 'y' });
    await saver.flush();
    saver.change({ name: '', icon: 'x' });
    await saver.flush();
    expect(calls).toEqual([
      [
        { name: '', icon: 'y' },
        { name: 'A', icon: 'x' },
      ],
      [
        { name: '', icon: 'x' },
        { name: 'A', icon: 'y' },
      ],
    ]);
  });

  it('gives a save queued behind one that stored nothing what is really stored', async () => {
    const storedArgs: Value[] = [];
    let release = () => {};
    const { saver } = makeSaver({ text: 'a' }, async (next, stored) => {
      storedArgs.push(stored);
      if (next.text === 'b') {
        await new Promise<void>((resolve) => (release = resolve));
        return false;
      }
      return true;
    });
    saver.change({ text: 'b' });
    const first = saver.flush();
    await Promise.resolve();
    saver.change({ text: 'c' });
    const second = saver.flush();
    release();
    await Promise.all([first, second]);
    expect(storedArgs).toEqual([{ text: 'a' }, { text: 'a' }]);
  });

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

  it('runs end() after the save under way and saves nothing after it', async () => {
    const order: string[] = [];
    let release = () => {};
    const { saver } = makeSaver({ text: 'a' }, async (next) => {
      order.push(`save ${next.text} start`);
      await new Promise<void>((resolve) => (release = resolve));
      order.push(`save ${next.text} end`);
      return true;
    });
    saver.change({ text: 'b' });
    const saving = saver.flush();
    await Promise.resolve();
    const ending = saver.end(async () => {
      order.push('delete');
    });
    release();
    await Promise.all([saving, ending]);
    saver.change({ text: 'c' });
    await saver.flush({ isLeaving: true });
    expect(order).toEqual(['save b start', 'save b end', 'delete']);
  });

  it('saves again after an end() whose write failed', async () => {
    const save = vi.fn(async () => true);
    const { saver } = makeSaver({ text: 'a' }, save);
    await expect(
      saver.end(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
    saver.change({ text: 'b' });
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
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
