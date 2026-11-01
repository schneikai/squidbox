import { describe, it, expect } from 'vitest';

import postedAtToSave from '../src/features/posts/postedAtToSave';

describe('postedAtToSave', () => {
  it('saves an untouched new post with the time of the save', () => {
    expect(postedAtToSave({ isNew: true, picked: undefined, seedPostedAt: 10, now: 99 })).toBe(99);
  });

  it('keeps the Posted time of an untouched edit', () => {
    expect(postedAtToSave({ isNew: false, picked: undefined, seedPostedAt: 10, now: 99 })).toBe(10);
    expect(postedAtToSave({ isNew: false, picked: undefined, seedPostedAt: null, now: 99 })).toBeNull();
  });

  it('saves a removed time as no Posted time, new post or edit', () => {
    expect(postedAtToSave({ isNew: true, picked: null, seedPostedAt: 10, now: 99 })).toBeNull();
    expect(postedAtToSave({ isNew: false, picked: null, seedPostedAt: 10, now: 99 })).toBeNull();
  });

  it('saves a picked time as picked', () => {
    expect(postedAtToSave({ isNew: true, picked: 42, seedPostedAt: 10, now: 99 })).toBe(42);
  });
});
