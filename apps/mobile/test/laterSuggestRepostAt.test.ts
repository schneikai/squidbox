import { afterEach, describe, expect, it, vi } from 'vitest';

import laterSuggestRepostAt from '../src/features/new-post/laterSuggestRepostAt';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('laterSuggestRepostAt', () => {
  it("lands on a whole millisecond between the post's suggestion and the newest", () => {
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0);
    expect(laterSuggestRepostAt({ suggestRepostAt: 1000 }, 2001)).toBe(1000);
    random.mockReturnValue(1);
    expect(laterSuggestRepostAt({ suggestRepostAt: 1000 }, 2001)).toBe(2001);
    random.mockReturnValue(0.5);
    expect(laterSuggestRepostAt({ suggestRepostAt: 1000 }, 2001)).toBe(1501);
  });

  it('starts from now for a post without a suggestion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(laterSuggestRepostAt({ suggestRepostAt: 0 }, 9000)).toBe(6000);
  });
});
