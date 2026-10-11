import { describe, it, expect } from 'vitest';

import { createSingleFlight } from '../src/sync/singleFlight';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createSingleFlight', () => {
  it('runs the task once per request when idle', async () => {
    let runs = 0;
    const flight = createSingleFlight(async () => {
      runs++;
    });

    flight.request();
    await settle();
    flight.request();
    await settle();

    expect(runs).toBe(2);
  });

  it('coalesces requests made during a run into one trailing run', async () => {
    const gate = deferred();
    let runs = 0;
    const flight = createSingleFlight(async () => {
      runs++;
      if (runs === 1) await gate.promise;
    });

    flight.request();
    flight.request();
    flight.request();
    await settle();
    expect(runs).toBe(1);

    gate.resolve();
    await settle();
    expect(runs).toBe(2);
  });

  it('runs exclusive work only after the running task finishes, and blocks new runs meanwhile', async () => {
    const taskGate = deferred();
    const workGate = deferred();
    const log: string[] = [];
    const flight = createSingleFlight(async () => {
      log.push('task:start');
      if (!log.includes('work:end')) await taskGate.promise;
      log.push('task:end');
    });

    flight.request();
    const work = flight.exclusive(async () => {
      log.push('work:start');
      await workGate.promise;
      log.push('work:end');
      return 'done';
    });
    await settle();
    expect(log).toEqual(['task:start']);

    taskGate.resolve();
    await settle();
    flight.request();
    await settle();
    expect(log).toEqual(['task:start', 'task:end', 'work:start']);

    workGate.resolve();
    await expect(work).resolves.toBe('done');
    await settle();
    expect(log).toEqual(['task:start', 'task:end', 'work:start', 'work:end', 'task:start', 'task:end']);
  });

  it('keeps going after a failing task or work item', async () => {
    let runs = 0;
    const flight = createSingleFlight(async () => {
      runs++;
      if (runs === 1) throw new Error('boom');
    });

    flight.request();
    await expect(flight.exclusive(async () => Promise.reject(new Error('nope')))).rejects.toThrow('nope');
    await expect(flight.exclusive(async () => 'after')).resolves.toBe('after');
    flight.request();
    await settle();

    expect(runs).toBe(2);
  });
});
