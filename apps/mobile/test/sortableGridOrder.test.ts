import { describe, it, expect } from 'vitest';

import heldOrder from '../src/components/sortable-grid/heldOrder';
import mergeRowIds from '../src/components/sortable-grid/mergeRowIds';

describe('the sortable grid’s held order after a drop', () => {
  const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  it('holds the dropped order until rows read at or after its write land', () => {
    const inFlight = { ids: ['d', 'a', 'b', 'c'] };
    expect(heldOrder(inFlight, rows, 9, true)).toEqual(['d', 'a', 'b', 'c']); // write not settled yet
    const written = { ...inFlight, writtenAt: 5 };
    expect(heldOrder(written, rows, 4, true)).toEqual(['d', 'a', 'b', 'c']); // read before the write committed
    expect(heldOrder(written, rows, 5, true)).toBeNull();
    expect(heldOrder(written, rows, 9, true)).toBeNull();
  });

  it('holds nothing without a drop or while reordering is off: the rows come in another order then', () => {
    expect(heldOrder(null, rows, 4, true)).toBeNull();
    expect(heldOrder({ ids: ['d', 'a', 'b', 'c'] }, rows, 4, false)).toBeNull();
  });

  it('follows rows that arrive or leave meanwhile', () => {
    const fewer = [{ id: 'a' }, { id: 'n' }, { id: 'c' }, { id: 'd' }];
    expect(heldOrder({ ids: ['d', 'a', 'b', 'c'] }, fewer, 4, true)).toEqual(['d', 'a', 'n', 'c']);
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
