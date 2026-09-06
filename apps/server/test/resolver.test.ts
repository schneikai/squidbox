import { describe, it, expect } from 'vitest';
import { resolveStorage, fullKey } from '../src/storage/resolver.js';
import { AppError } from '../src/errors.js';

describe('storage resolver (multi-tenant isolation)', () => {
  it('existing account keeps its legacy bucket with empty prefix', () => {
    const loc = resolveStorage({ id: 'u1', storageBucket: 'legacy-bucket' }, 'shared');
    expect(loc).toEqual({ bucket: 'legacy-bucket', keyPrefix: '' });
    expect(fullKey(loc, 'photo.jpg')).toBe('photo.jpg');
  });

  it('new user gets the shared bucket + per-user prefix', () => {
    const loc = resolveStorage({ id: 'abc', storageBucket: null }, 'shared');
    expect(loc).toEqual({ bucket: 'shared', keyPrefix: 'u/abc/' });
    expect(fullKey(loc, 'photo.jpg')).toBe('u/abc/photo.jpg');
  });

  it('keys are always namespaced per user (no cross-tenant reach)', () => {
    const a = resolveStorage({ id: 'A', storageBucket: null }, 'shared');
    const b = resolveStorage({ id: 'B', storageBucket: null }, 'shared');
    expect(fullKey(a, 'x')).toBe('u/A/x');
    expect(fullKey(b, 'x')).toBe('u/B/x');
    expect(fullKey(a, 'x')).not.toBe(fullKey(b, 'x'));
  });

  it('rejects keys that try to escape the namespace', () => {
    const loc = resolveStorage({ id: 'u1', storageBucket: null }, 'shared');
    expect(() => fullKey(loc, '/etc/passwd')).toThrow(AppError);
    expect(() => fullKey(loc, '../other/x')).toThrow(AppError);
    expect(() => fullKey(loc, 'a/../../b')).toThrow(AppError);
    expect(() => fullKey(loc, '')).toThrow(AppError);
  });
});
