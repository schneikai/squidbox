import { describe, it, expect } from 'vitest';

import applyPendingMoves from '../src/components/sortable-grid/applyPendingMoves';
import dropLandedMoves from '../src/components/sortable-grid/dropLandedMoves';
import mergeRowIds from '../src/components/sortable-grid/mergeRowIds';

const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((row) => row.id).join('');

describe('the sortable grid’s pending moves', () => {
  it('shows a drop before the rows do: the row right after afterId, or first', () => {
    expect(ids(applyPendingMoves(rows, []))).toBe('abcd');
    expect(ids(applyPendingMoves(rows, [{ id: 'd', afterId: 'a' }]))).toBe('adbc');
    expect(ids(applyPendingMoves(rows, [{ id: 'c', afterId: null }]))).toBe('cabd');
  });

  it('applies several drops in turn, as the database does, so a second drag of the same row wins', () => {
    const moves = [
      { id: 'd', afterId: 'a' }, // a d b c
      { id: 'b', afterId: 'd' }, // b follows d where d is now
      { id: 'd', afterId: 'c' }, // d moves again; b stays
    ];
    expect(ids(applyPendingMoves(rows, moves))).toBe('abcd');
    expect(ids(applyPendingMoves(rows, moves.slice(0, 2)))).toBe('adbc');
  });

  it('ignores a drop whose row or afterId left the rows', () => {
    expect(ids(applyPendingMoves(rows, [{ id: 'x', afterId: 'a' }]))).toBe('abcd');
    expect(ids(applyPendingMoves(rows, [{ id: 'b', afterId: 'x' }]))).toBe('abcd');
  });

  it('drops a move once rows read after its write land, not rows read before it', () => {
    const written = { id: 'd', afterId: 'a', writtenAt: 5 };
    const unwritten = { id: 'b', afterId: null };
    expect(dropLandedMoves([written, unwritten], 4, true)).toEqual([written, unwritten]); // read before the write committed
    expect(dropLandedMoves([written, unwritten], 5, true)).toEqual([unwritten]);
    expect(dropLandedMoves([written, unwritten], 9, true)).toEqual([unwritten]);
  });

  it('drops every move once reordering is off: the rows come in another order then', () => {
    const unwritten = { id: 'b', afterId: null };
    expect(dropLandedMoves([unwritten], 4, false)).toEqual([]);
    const none: (typeof unwritten)[] = [];
    expect(dropLandedMoves(none, 4, false)).toBe(none);
  });
});

describe('a drag’s slots with rows that arrive meanwhile', () => {
  it('appends a loaded page, puts a new row after the one before it, and drops rows that left', () => {
    // The drag moved c to the front; then a page (e, f) loaded, a new row n synced in after a, and
    // b left.
    expect(mergeRowIds(['c', 'a', 'b', 'd'], ['n0', 'a', 'n', 'c', 'd', 'e', 'f'], 'c')).toEqual([
      'n0',
      'c',
      'a',
      'n',
      'd',
      'e',
      'f',
    ]);
  });

  it('keeps the lifted row even when it left the rows', () => {
    expect(mergeRowIds(['a', 'b'], ['b'], 'a')).toEqual(['a', 'b']);
  });
});
