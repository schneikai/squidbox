import { describe, expect, it, vi } from 'vitest';

import { flushTurns } from './helpers/flushTurns';
import tagAttempts from '../src/features/photo-tags/tagAttempts';

describe('tagAttempts', () => {
  it('starts a photo by itself once, however often it is asked, and forgets it once tagged', async () => {
    const tag = vi.fn().mockResolvedValue(['forest']);
    tagAttempts.once('a1', tag);
    expect(tagAttempts.get().a1).toMatchObject({ status: 'loading', error: null });
    tagAttempts.once('a1', tag);
    await flushTurns();
    expect(tagAttempts.get().a1).toBeUndefined();
    tagAttempts.once('a1', tag);
    expect(tag).toHaveBeenCalledTimes(1);
  });

  it('joins a tagging under way, wherever it started', async () => {
    const tag = vi.fn().mockResolvedValue(['moss']);
    const running = tagAttempts.run('a2', tag);
    expect(tagAttempts.run('a2', tag)).toBe(running);
    tagAttempts.once('a2', tag);
    await expect(running).resolves.toEqual(['moss']);
    expect(tag).toHaveBeenCalledTimes(1);
  });

  it('keeps a failure until the next run, which tags it again', async () => {
    const tag = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(['moss']);
    tagAttempts.once('a3', tag);
    await flushTurns();
    expect(tagAttempts.get().a3).toMatchObject({ status: 'error', error: 'Network Error' });
    tagAttempts.once('a3', tag);
    expect(tag).toHaveBeenCalledTimes(1);
    await expect(tagAttempts.run('a3', tag)).resolves.toEqual(['moss']);
    expect(tagAttempts.get().a3).toBeUndefined();
  });

  it('says which photos were tagged in this app run, from the start of their tagging', async () => {
    expect(tagAttempts.hasRun('a6')).toBe(false);
    const tagging = tagAttempts.run('a6', () => Promise.resolve(['moss']));
    expect(tagAttempts.hasRun('a6')).toBe(true);
    await tagging;
    expect(tagAttempts.hasRun('a6')).toBe(true);
  });

  it('passes a failure on to the caller', async () => {
    await expect(tagAttempts.run('a4', () => Promise.reject(new Error('gone')))).rejects.toThrow('gone');
  });

  it('tells subscribers on each change, with a new map', async () => {
    const listener = vi.fn();
    const unsubscribe = tagAttempts.subscribe(listener);
    const before = tagAttempts.get();
    const tagging = tagAttempts.run('a5', () => Promise.resolve([]));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(tagAttempts.get()).not.toBe(before);
    await tagging;
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await tagAttempts.run('a5', () => Promise.resolve([]));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
