import type { NavigationState } from 'expo-router/react-navigation';
import { describe, expect, it, vi } from 'vitest';

import leaveWithNewPostSheet from '../src/features/posts/leaveWithNewPostSheet';

// The sheets' stack with these routes, at `index`.
function sheets(routeNames: string[], index: number) {
  const state: NavigationState = {
    key: 'sheets',
    index,
    routeNames,
    routes: routeNames.map((name) => ({ key: `${name}-key`, name })),
    type: 'stack',
    stale: false,
  };
  return { getState: () => state, pop: vi.fn() };
}

describe('leaveWithNewPostSheet', () => {
  it('closes the editor and the New post sheet it was opened over', () => {
    const stack = sheets(['(main)', '(new-post)', '(editor)'], 2);

    leaveWithNewPostSheet(stack)?.();

    expect(stack.pop).toHaveBeenCalledOnce();
    expect(stack.pop).toHaveBeenCalledWith(2);
  });

  it('leaves the editor as it came when it was not opened over the New post sheet', () => {
    for (const stack of [sheets(['(main)', '(editor)'], 1), sheets(['(editor)'], 0)]) {
      expect(leaveWithNewPostSheet(stack)).toBeUndefined();
      expect(stack.pop).not.toHaveBeenCalled();
    }
  });
});
