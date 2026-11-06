import { describe, it, expect } from 'vitest';

import assetHref from '../src/features/asset-list/assetHref';
import assetQueryFromParams from '../src/features/asset-list/assetQueryFromParams';
import { assetScopeFromParam, assetScopeToParam } from '../src/features/asset-list/assetScopeParam';
import type { AssetQueryScope } from '../src/sync/assetSql';

describe('the asset screen URL', () => {
  it('reads back the scope, sort, filter and search it was written with', () => {
    const scopes: AssetQueryScope[] = [
      'library',
      'favorites',
      'deleted',
      { albumId: 'a1' },
      { postId: 'p1' },
      { assetId: 'x1' },
      { contactId: 'c1' },
    ];
    for (const scope of scopes) expect(assetScopeFromParam(assetScopeToParam(scope))).toEqual(scope);
    const { params } = assetHref('x1', {
      scope: { albumId: 'a1' },
      sort: 'createdAt:asc',
      filter: ['favorites', 'videos'],
      search: 'ridge',
    });
    expect(assetQueryFromParams(params)).toEqual({
      scope: { albumId: 'a1' },
      sort: 'createdAt:asc',
      filter: ['favorites', 'videos'],
      search: 'ridge',
    });
  });

  it('opens a stale link on the defaults: an unknown sort, filter or scope kind is left out', () => {
    expect(assetQueryFromParams({ scope: 'shared:s1', sort: 'name:asc', filter: 'favorites,raw' })).toEqual({
      scope: 'library',
      sort: undefined,
      filter: ['favorites'],
      search: undefined,
    });
    expect(assetScopeFromParam('everything')).toBe('library');
  });
});
