import { aiModelKindSchema } from '@squidbox/shared';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import useAvailableParam from '../src/hooks/useAvailableParam';

// The route, the account and the navigation are replaced: what the link names, whether the screen
// is available, and what the hook asks useCloseWhen.
const state = vi.hoisted(() => ({ params: { kind: 'vision' }, isAvailable: true }));
const closeWhen = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useLocalSearchParams: () => state.params }));
vi.mock('../src/hooks/useAvailableUserId', () => ({ default: () => (state.isAvailable ? 'me' : null) }));
vi.mock('../src/hooks/useCloseWhen', () => ({ default: closeWhen }));

function renderKind(kind: string, isAvailable = true) {
  state.params = { kind };
  state.isAvailable = isAvailable;
  let result: unknown;
  function Probe() {
    result = useAvailableParam('kind', aiModelKindSchema, 'ai_admin');
    return null;
  }
  renderToString(createElement(Probe));
  return result;
}

describe('useAvailableParam', () => {
  it('gives the value a link names', () => {
    expect(renderKind('vision')).toEqual({ value: 'vision', userId: 'me' });
    expect(closeWhen).toHaveBeenCalledWith(false);
  });

  it("closes a screen whose link names a value that doesn't parse", () => {
    expect(renderKind('foo')).toBeNull();
    expect(closeWhen).toHaveBeenCalledWith(true);
  });

  it("leaves the closing to useAvailableUserId while the screen isn't available", () => {
    expect(renderKind('foo', false)).toBeNull();
    expect(closeWhen).toHaveBeenCalledWith(false);
    expect(closeWhen).not.toHaveBeenCalledWith(true);
  });
});
