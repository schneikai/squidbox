import type { NavigationState } from 'expo-router/react-navigation';
import { describe, expect, it, vi } from 'vitest';

import leaveWithNewPostSheet from '../src/features/posts/leaveWithNewPostSheet';

// The editor's navigation, in a stack of sheets with these routes, at `index`.
function editorIn(routeNames: string[], index: number) {
  const state: NavigationState = {
    key: 'sheets',
    index,
    routeNames,
    routes: routeNames.map((name) => ({ key: `${name}-key`, name })),
    type: 'stack',
    stale: false,
  };
  const sheets = { getState: () => state, pop: vi.fn() };
  return { sheets, editor: { getParent: <T>() => sheets as T } };
}

describe('leaveWithNewPostSheet', () => {
  it('closes the editor and the New post sheet it was opened over', () => {
    const { sheets, editor } = editorIn(['(main)', '(new-post)', '(editor)'], 2);

    leaveWithNewPostSheet(editor)?.();

    expect(sheets.pop).toHaveBeenCalledOnce();
    expect(sheets.pop).toHaveBeenCalledWith(2);
  });

  it('leaves the editor as it came when it was not opened over the New post sheet', () => {
    for (const { sheets, editor } of [editorIn(['(main)', '(editor)'], 1), editorIn(['(editor)'], 0)]) {
      expect(leaveWithNewPostSheet(editor)).toBeUndefined();
      expect(sheets.pop).not.toHaveBeenCalled();
    }
  });

  it('goes back without throwing when the editor has no sheets around it (the post is already added)', () => {
    expect(leaveWithNewPostSheet({ getParent: () => undefined })).toBeUndefined();
  });
});
