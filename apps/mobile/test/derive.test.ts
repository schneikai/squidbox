import { describe, it, expect } from 'vitest';
import {
  orderedAssetsByAlbum,
  assetRefsByPost,
  deriveAssetPostHistory,
  deriveAlbumPostHistory,
} from '../src/sync/derive';

describe('derive (edge → record-shape projections)', () => {
  it('orderedAssetsByAlbum: sorts by position, drops tombstones, dedupes by asset', () => {
    const edges = [
      { id: 'e1', albumId: 'AL', assetId: 'a', position: 'b', deletedAt: null },
      { id: 'e2', albumId: 'AL', assetId: 'c', position: 'a', deletedAt: null },
      { id: 'e3', albumId: 'AL', assetId: 'x', position: 'c', deletedAt: 999 }, // tombstoned
      { id: 'e4', albumId: 'AL', assetId: 'c', position: 'd', deletedAt: null }, // dup asset c
    ];
    expect(orderedAssetsByAlbum(edges)).toEqual({ AL: ['c', 'a'] });
  });

  it('assetRefsByPost: returns ordered {id, assetId} using the edge id', () => {
    const edges = [
      { id: 'r2', postId: 'P', assetId: 'a2', position: 'b', deletedAt: null },
      { id: 'r1', postId: 'P', assetId: 'a1', position: 'a', deletedAt: null },
    ];
    expect(assetRefsByPost(edges)).toEqual({ P: [{ id: 'r1', assetId: 'a1' }, { id: 'r2', assetId: 'a2' }] });
  });

  it('deriveAssetPostHistory: posts referencing an asset, ordered by postedAt; skips deleted posts', () => {
    const posts = {
      p1: { id: 'p1', postedAt: 200, deletedAt: null },
      p2: { id: 'p2', postedAt: 100, deletedAt: null },
      p3: { id: 'p3', postedAt: 300, deletedAt: 999 }, // deleted → excluded
    };
    const edges = [
      { id: 'e1', postId: 'p1', assetId: 'a', position: 'a', deletedAt: null },
      { id: 'e2', postId: 'p2', assetId: 'a', position: 'a', deletedAt: null },
      { id: 'e3', postId: 'p3', assetId: 'a', position: 'a', deletedAt: null },
    ];
    const { historyById, lastPostedAtById } = deriveAssetPostHistory(posts, edges);
    expect(historyById.a).toEqual(['p2', 'p1']); // by postedAt asc
    expect(lastPostedAtById.a).toBe(200);
  });

  it('deriveAlbumPostHistory: posts referencing any asset the album contains', () => {
    const posts = { p1: { id: 'p1', postedAt: 100, deletedAt: null } };
    const postEdges = [{ id: 'pe', postId: 'p1', assetId: 'a', position: 'a', deletedAt: null }];
    const albumEdges = [{ id: 'ae', albumId: 'AL', assetId: 'a', position: 'a', deletedAt: null }];
    const { historyById, lastPostedAtById } = deriveAlbumPostHistory(posts, postEdges, albumEdges);
    expect(historyById.AL).toEqual(['p1']);
    expect(lastPostedAtById.AL).toBe(100);
  });
});
