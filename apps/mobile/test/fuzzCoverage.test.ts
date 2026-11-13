import { describe, expect, it } from 'vitest';

import { fuzzedCollections, notFuzzed } from './helpers/fuzzedCollections';
import { clientCollectionTables } from '../src/sync/clientCollections';

describe('the two-device fuzz', () => {
  it('writes every collection in the registry, or names why it leaves one out', () => {
    expect([...fuzzedCollections, ...Object.keys(notFuzzed)].sort()).toEqual(
      Object.keys(clientCollectionTables).sort(),
    );
  });
});
