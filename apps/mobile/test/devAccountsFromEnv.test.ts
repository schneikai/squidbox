import { describe, expect, it } from 'vitest';

import devAccountsFromEnv from '../src/features/dev-accounts/devAccountsFromEnv';

const mock = { label: 'Mock library', email: 'me@example.com', password: 'secret' };

describe('devAccountsFromEnv', () => {
  it('lists no accounts when the env is unset', () => {
    expect(devAccountsFromEnv(undefined)).toEqual([]);
  });

  it('leaves out an account without its sign-in', () => {
    const copy = { label: 'Copy of my library', isLiveLibraryCopy: true };
    expect(devAccountsFromEnv(JSON.stringify([mock, copy]))).toEqual([mock]);
  });
});
