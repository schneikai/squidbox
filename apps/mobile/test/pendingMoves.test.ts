import { describe, it, expect } from 'vitest';

import applyPendingMoves from '../src/features/asset-list/applyPendingMoves';
import dropLandedMoves from '../src/features/asset-list/dropLandedMoves';

const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((row) => row.id).join('');

describe('the sortable grid’s pending moves', () => {
  it('shows a drop before the rows do: the asset right after afterId, or first', () => {
    expect(ids(applyPendingMoves(rows, []))).toBe('abcd');
    expect(ids(applyPendingMoves(rows, [{ assetId: 'd', afterId: 'a' }]))).toBe('adbc');
    expect(ids(applyPendingMoves(rows, [{ assetId: 'c', afterId: null }]))).toBe('cabd');
  });

  it('applies several drops in turn, as the database does, so a second drag of the same asset wins', () => {
    const moves = [
      { assetId: 'd', afterId: 'a' }, // a d b c
      { assetId: 'b', afterId: 'd' }, // b follows d where d is now
      { assetId: 'd', afterId: 'c' }, // d moves again; b stays
    ];
    expect(ids(applyPendingMoves(rows, moves))).toBe('abcd');
    expect(ids(applyPendingMoves(rows, moves.slice(0, 2)))).toBe('adbc');
  });

  it('ignores a drop whose asset or afterId left the rows', () => {
    expect(ids(applyPendingMoves(rows, [{ assetId: 'x', afterId: 'a' }]))).toBe('abcd');
    expect(ids(applyPendingMoves(rows, [{ assetId: 'b', afterId: 'x' }]))).toBe('abcd');
  });

  it('drops a move once rows read after its write land, not rows read before it', () => {
    const written = { assetId: 'd', afterId: 'a', writtenAt: 5 };
    const unwritten = { assetId: 'b', afterId: null };
    expect(dropLandedMoves([written, unwritten], 4)).toEqual([written, unwritten]); // read before the write committed
    expect(dropLandedMoves([written, unwritten], 5)).toEqual([unwritten]);
    expect(dropLandedMoves([written, unwritten], 9)).toEqual([unwritten]);
  });
});
