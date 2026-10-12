import { describe, it, expect } from 'vitest';

import { deriveRecords } from '../src/sync/deriveRecords';

describe('deriveRecords', () => {
  const a = { id: 'a', isFavorite: false };
  const b = { id: 'b', isFavorite: false };
  const history = ['p1'];
  const extrasOf = (row: { id: string }) => ({ postHistory: row.id === 'a' ? history : [] });

  it('merges the derived fields onto each row', () => {
    const { records } = deriveRecords([a], extrasOf);
    expect(records.a).toEqual({ id: 'a', isFavorite: false, postHistory: ['p1'] });
  });

  it('keeps the previous record while its row and derived values are the same objects', () => {
    const NONE: string[] = [];
    const stableExtras = (row: { id: string }) => ({ postHistory: row.id === 'a' ? history : NONE });
    const first = deriveRecords([a, b], stableExtras);
    const changedB = { ...b, isFavorite: true };
    const second = deriveRecords([a, changedB], stableExtras, first);
    expect(second.records.a).toBe(first.records.a);
    expect(second.records.b).not.toBe(first.records.b);
    expect(second.records.b.isFavorite).toBe(true);
  });

  it('rebuilds a record when a derived value changes', () => {
    const first = deriveRecords([a], () => ({ postHistory: ['p1'] }));
    const second = deriveRecords([a], () => ({ postHistory: ['p1', 'p2'] }), first);
    expect(second.records.a).not.toBe(first.records.a);
  });

  it('returns the previous result when no row changed', () => {
    const first = deriveRecords([a, b], extrasOf);
    expect(deriveRecords([a, b], extrasOf, first)).toBe(first);
  });

  it('drops removed rows', () => {
    const first = deriveRecords([a, b], extrasOf);
    expect(Object.keys(deriveRecords([a], extrasOf, first).records)).toEqual(['a']);
  });

  it('keeps records whose derived arrays were rebuilt with the same content', () => {
    const first = deriveRecords([a], () => ({ postHistory: ['p1'], assetRefs: [{ id: 'e1', assetId: 'a' }] }));
    const second = deriveRecords([a], () => ({ postHistory: ['p1'], assetRefs: [{ id: 'e1', assetId: 'a' }] }), first);
    expect(second.records).toBe(first.records);
  });
});
