import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import useAvailableModelKind from '../src/hooks/useAvailableModelKind';

// The route, the account and the navigation are replaced: what the link names, whether the screen
// is available, and what the hook asks useCloseWhen.
const state = vi.hoisted(() => ({ params: { kind: 'vision' }, isAvailable: true }));
const closeWhen = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useLocalSearchParams: () => state.params }));
vi.mock('../src/hooks/useLeaveWhenUnavailable', () => ({ default: () => state.isAvailable }));
vi.mock('../src/hooks/useCloseWhen', () => ({ default: closeWhen }));

function renderKind(kind: string, isAvailable = true) {
  state.params = { kind };
  state.isAvailable = isAvailable;
  let result: unknown;
  function Probe() {
    result = useAvailableModelKind();
    return null;
  }
  renderToString(createElement(Probe));
  return result;
}

describe('useAvailableModelKind', () => {
  it('gives the kind a link names', () => {
    expect(renderKind('vision')).toBe('vision');
    expect(closeWhen).toHaveBeenCalledWith(false);
  });

  it('closes a screen whose link names an unknown kind', () => {
    expect(renderKind('foo')).toBeNull();
    expect(closeWhen).toHaveBeenCalledWith(true);
  });

  it("leaves the closing to useLeaveWhenUnavailable while the screen isn't available", () => {
    expect(renderKind('foo', false)).toBeNull();
    expect(closeWhen).toHaveBeenCalledWith(false);
    expect(closeWhen).not.toHaveBeenCalledWith(true);
  });
});
