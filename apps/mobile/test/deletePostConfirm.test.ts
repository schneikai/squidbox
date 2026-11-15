import { describe, expect, it } from 'vitest';

import deletePostConfirm from '../src/features/post-detail/actions/deletePostConfirm';

describe('deletePostConfirm', () => {
  it('asks plainly about a single post', () => {
    expect(deletePostConfirm({ threadCount: 0 })).toEqual({ name: 'this post' });
  });

  it("counts a thread's posts", () => {
    expect(deletePostConfirm({ threadCount: 2 })).toEqual({ name: 'this thread', also: 'All 3 of its posts go.' });
  });
});
