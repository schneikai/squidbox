import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import createThumbnailQueue from '../src/features/asset-thumbnail-loader/createThumbnailQueue';

type Asset = { thumbnailFilename: string };

// A loader whose batches stay open until the test settles them with the keys that landed.
function setup() {
  const batches: {
    keys: string[];
    signal: AbortSignal;
    resolve(available: Set<string>): void;
    reject(error: Error): void;
  }[] = [];
  const errors: unknown[] = [];
  const queue = createThumbnailQueue({
    load: (assets: Asset[], signal: AbortSignal) =>
      new Promise<Set<string>>((resolve, reject) => {
        batches.push({ keys: assets.map((asset) => asset.thumbnailFilename), signal, resolve, reject });
      }),
    onError: (error: unknown) => errors.push(error),
  });
  const results: string[] = [];
  const request = (key: string) =>
    queue.request({ thumbnailFilename: key }, (result: string) => results.push(`${key} ${result}`));
  async function settle(index: number, landed = batches[index]!.keys) {
    batches[index]!.resolve(new Set(landed));
    await vi.advanceTimersByTimeAsync(0);
  }
  // Fails the newest batch until its keys ran out of retries.
  async function failOut() {
    await settle(batches.length - 1, []);
    for (let retry = 1; retry <= 3; retry++) {
      await vi.advanceTimersByTimeAsync(5000);
      await settle(batches.length - 1, []);
    }
  }
  return { queue, batches, errors, results, request, settle, failOut };
}

const keys = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => `t${from + i}`);

describe('createThumbnailQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the newest live requests first, two batches of 12 at most, and only while enabled', async () => {
    const { queue, batches, request, settle } = setup();
    const withdraw = keys(0, 30).map((key) => request(key));
    withdraw[29]!(); // scrolled away before it loaded
    request('t1'); // in view again
    expect(batches).toHaveLength(0);
    queue.setEnabled(true);
    expect(batches[0]!.keys).toEqual(['t1', ...keys(18, 29).reverse()]);
    expect(batches[1]!.keys).toEqual(keys(6, 18).reverse());
    for (const index of [2, 3, 4, 5]) withdraw[index]!();
    queue.setEnabled(false);
    await settle(0);
    expect(batches).toHaveLength(2);
    queue.setEnabled(true);
    expect(batches[2]!.keys).toEqual(['t0']);
  });

  it('tells every listener of a key once it landed, and nobody whose cell left meanwhile', async () => {
    const { queue, batches, results, request, settle } = setup();
    queue.setEnabled(true);
    request('a');
    request('a');
    request('b')();
    expect(batches.map((batch) => batch.keys)).toEqual([['a'], ['b']]); // one load per key
    await settle(0);
    await settle(1);
    expect(results).toEqual(['a done', 'a done']);
    request('b'); // asked again: a fresh request
    expect(batches[2]!.keys).toEqual(['b']);
  });

  it('retries the keys missing from a batch together, behind fresh requests, 3 times, then reports each failed', async () => {
    const { queue, batches, errors, results, request, settle } = setup();
    request('bad');
    request('also-bad');
    queue.setEnabled(true);
    await settle(0, []);
    request('fresh');
    request('busy'); // both slots taken when the retry is due
    request('next');
    await vi.advanceTimersByTimeAsync(5000);
    await settle(1);
    expect(batches[3]!.keys).toEqual(['next', 'also-bad', 'bad']);
    await settle(2);
    await settle(3, ['next']);
    for (let attempt = 3; attempt <= 4; attempt++) {
      await vi.advanceTimersByTimeAsync(5000);
      expect(batches.at(-1)!.keys).toEqual(['also-bad', 'bad']);
      await settle(batches.length - 1, []);
    }
    expect(results).toEqual(['fresh done', 'busy done', 'next done', 'also-bad failed', 'bad failed']);
    expect(errors).toHaveLength(2); // each key that gave up
    await vi.advanceTimersByTimeAsync(59000);
    expect(batches).toHaveLength(6); // no more retries for now
    request('bad'); // a remounted cell asks again
    expect(batches[6]!.keys).toEqual(['bad']);
  });

  it('gives the failed keys still in view another chance: every minute, when asked to (foreground) and on sign-in', async () => {
    const { queue, batches, results, request, settle, failOut } = setup();
    queue.setEnabled(true);
    request('a');
    await failOut();
    expect(results).toEqual(['a failed']);
    await vi.advanceTimersByTimeAsync(60000);
    await settle(batches.length - 1);
    expect(results).toEqual(['a failed', 'a done']); // the same cell hears it

    request('b');
    await failOut();
    queue.retryFailed();
    await failOut(); // its retries start afresh
    queue.setEnabled(false);
    queue.setEnabled(true);
    await settle(batches.length - 1);
    expect(results).toEqual(['a failed', 'a done', 'b failed', 'b failed', 'b done']);
  });

  it('counts a batch that failed as a whole against no key, and reports it once', async () => {
    const { queue, batches, errors, results, request, settle } = setup();
    request('a');
    request('b');
    queue.setEnabled(true);
    for (let attempt = 0; attempt < 6; attempt++) {
      batches.at(-1)!.reject(new Error('presign failed'));
      await vi.advanceTimersByTimeAsync(5000);
    }
    expect(errors).toHaveLength(6);
    expect(results).toEqual([]);
    await settle(batches.length - 1);
    expect(results).toEqual(['b done', 'a done']);
  });

  it('stops retrying a key whose cell left, leaving the others queued', async () => {
    const { queue, batches, request, settle } = setup();
    queue.setEnabled(true);
    const withdraw = request('bad');
    await settle(0, []);
    request('x');
    request('y');
    request('z'); // queued behind the two in flight
    withdraw(); // while 'bad' waits for its retry
    await settle(1);
    expect(batches[3]!.keys).toEqual(['z']);
    await vi.advanceTimersByTimeAsync(60000);
    expect(batches).toHaveLength(4);
  });

  it('loads a key waiting for its retry first when it’s asked for again', async () => {
    const { queue, batches, request, settle } = setup();
    queue.setEnabled(true);
    request('bad');
    await settle(0, []);
    request('x');
    request('y');
    request('z');
    request('bad'); // in view again
    await settle(1);
    expect(batches[3]!.keys).toEqual(['bad', 'z']);
    await vi.advanceTimersByTimeAsync(5000); // its old retry is void
    expect(batches).toHaveLength(4);
  });

  it('drops everything on dispose: what was in flight neither reports nor loads more', async () => {
    const { queue, batches, errors, results, request, settle } = setup();
    queue.setEnabled(true);
    request('a');
    await settle(0, []); // 'a' waits for its retry
    request('b');
    queue.dispose();
    expect(batches[1]!.signal.aborted).toBe(true);
    await settle(1);
    batches[1]!.reject(new Error('aborted'));
    await vi.advanceTimersByTimeAsync(120000);
    expect(batches).toHaveLength(2);
    expect(results).toEqual([]);
    expect(errors).toEqual([]);
    queue.setEnabled(true); // a provider mounted again
    request('c');
    expect(batches[2]!.keys).toEqual(['c']);
  });
});
