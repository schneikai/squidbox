import { describe, expect, it, vi } from 'vitest';

import { getTagAttempts, retryTagging, subscribeTagAttempts, tagOnce } from '../src/features/photo-tags/tagAttempts';

describe('tagAttempts', () => {
  it('starts a photo once, however often it is asked', async () => {
    const tag = vi.fn().mockResolvedValue(['forest']);
    const first = tagOnce('a1', tag);
    expect(getTagAttempts().a1).toMatchObject({ status: 'loading', error: null });
    expect(tagOnce('a1', tag)).toBe(first);
    await first;
    expect(getTagAttempts().a1).toMatchObject({ status: 'done', error: null });
    await tagOnce('a1', tag);
    expect(tag).toHaveBeenCalledTimes(1);
  });

  it('keeps a failure until a retry, which tags it again', async () => {
    const tag = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(['moss']);
    await tagOnce('a2', tag);
    expect(getTagAttempts().a2).toMatchObject({ status: 'error', error: 'Network Error' });
    await tagOnce('a2', tag);
    expect(tag).toHaveBeenCalledTimes(1);
    const retrying = retryTagging('a2', tag);
    expect(retryTagging('a2', tag)).toBe(retrying);
    await retrying;
    expect(tag).toHaveBeenCalledTimes(2);
    expect(getTagAttempts().a2).toMatchObject({ status: 'done' });
  });

  it('tells subscribers on each change, with a new map', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTagAttempts(listener);
    const before = getTagAttempts();
    const tagging = tagOnce('a3', () => Promise.resolve([]));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTagAttempts()).not.toBe(before);
    await tagging;
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await retryTagging('a3', () => Promise.resolve([]));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
