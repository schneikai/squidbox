import { describe, expect, it, vi } from 'vitest';

import { getTagAttempts, runTagging, subscribeTagAttempts, tagOnce } from '../src/features/photo-tags/tagAttempts';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('tagAttempts', () => {
  it('starts a photo by itself once, however often it is asked, and forgets it once tagged', async () => {
    const tag = vi.fn().mockResolvedValue(['forest']);
    tagOnce('a1', tag);
    expect(getTagAttempts().a1).toMatchObject({ status: 'loading', error: null });
    tagOnce('a1', tag);
    await settle();
    expect(getTagAttempts().a1).toBeUndefined();
    tagOnce('a1', tag);
    expect(tag).toHaveBeenCalledTimes(1);
  });

  it('joins a tagging under way, wherever it started', async () => {
    const tag = vi.fn().mockResolvedValue(['moss']);
    const running = runTagging('a2', tag);
    expect(runTagging('a2', tag)).toBe(running);
    tagOnce('a2', tag);
    await expect(running).resolves.toEqual(['moss']);
    expect(tag).toHaveBeenCalledTimes(1);
  });

  it('keeps a failure until the next run, which tags it again', async () => {
    const tag = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(['moss']);
    tagOnce('a3', tag);
    await settle();
    expect(getTagAttempts().a3).toMatchObject({ status: 'error', error: 'Network Error' });
    tagOnce('a3', tag);
    expect(tag).toHaveBeenCalledTimes(1);
    await expect(runTagging('a3', tag)).resolves.toEqual(['moss']);
    expect(getTagAttempts().a3).toBeUndefined();
  });

  it('passes a failure on to the caller', async () => {
    await expect(runTagging('a4', () => Promise.reject(new Error('gone')))).rejects.toThrow('gone');
  });

  it('tells subscribers on each change, with a new map', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTagAttempts(listener);
    const before = getTagAttempts();
    const tagging = runTagging('a5', () => Promise.resolve([]));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTagAttempts()).not.toBe(before);
    await tagging;
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await runTagging('a5', () => Promise.resolve([]));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
