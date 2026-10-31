import { deferred } from '@squidbox/shared/testing/deferred';
import { describe, it, expect } from 'vitest';

import { flushTurns } from './helpers/flushTurns';
import { createSingleFlight } from '../src/sync/singleFlight';

describe('createSingleFlight', () => {
  it('runs the task once per request when idle', async () => {
    let runs = 0;
    const flight = createSingleFlight(async () => {
      runs++;
    });

    flight.request();
    await flushTurns();
    flight.request();
    await flushTurns();

    expect(runs).toBe(2);
  });

  it('coalesces requests made during a run into one trailing run, and is idle once that ends', async () => {
    const gate = deferred();
    let runs = 0;
    const flight = createSingleFlight(async () => {
      runs++;
      if (runs === 1) await gate.promise;
    });

    flight.request();
    flight.request();
    flight.request();
    await flushTurns();
    expect(runs).toBe(1);

    gate.resolve();
    await flight.idle();
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
    await flushTurns();
    expect(log).toEqual(['task:start']);

    taskGate.resolve();
    await flushTurns();
    flight.request();
    await flushTurns();
    expect(log).toEqual(['task:start', 'task:end', 'work:start']);

    workGate.resolve();
    await expect(work).resolves.toBe('done');
    await flushTurns();
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
    await flushTurns();

    expect(runs).toBe(2);
  });
});
