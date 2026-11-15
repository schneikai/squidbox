import { describe, expect, it } from 'vitest';

import deletePostConfirm from '../src/features/post-detail/actions/deletePostConfirm';

describe('deletePostConfirm', () => {
  it('asks plainly about a single post', () => {
    expect(deletePostConfirm({ threadCount: 0, copyCount: 0 })).toEqual({ name: 'this post' });
  });

  it("counts a thread's posts", () => {
    expect(deletePostConfirm({ threadCount: 2, copyCount: 0 })).toEqual({
      name: 'this thread',
      also: 'All 3 of its posts go.',
    });
  });

  it('says that its channel copies go too', () => {
    expect(deletePostConfirm({ threadCount: 0, copyCount: 2 })).toEqual({
      name: 'this post',
      also: 'Its channel copies go too.',
    });
    expect(deletePostConfirm({ threadCount: 1, copyCount: 1 }).also).toBe(
      'All 2 of its posts go. Its channel copies go too.',
    );
  });
});
