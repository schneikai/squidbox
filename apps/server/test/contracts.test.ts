import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import {
  resolveExpiresIn,
  PRESIGN_DEFAULT_EXPIRES_IN,
  PRESIGN_MAX_EXPIRES_IN,
  MULTIPART_PART_SIZE,
} from '@squidbox/shared';
import { AppError, errorBody } from '../src/errors.js';
import { serverCollections } from '../src/sync/collections.js';

// The largest whole number each integer column type takes from JS: bigint holds more, but a number
// past Number.MAX_SAFE_INTEGER isn't exact.
const INTEGER_MAX: Record<string, number> = { integer: 2 ** 31 - 1, bigint: Number.MAX_SAFE_INTEGER };

describe('sync record schemas', () => {
  // The schema rejects up front what a column can't store, so the push rejects it per record.
  for (const { name, table, schema } of Object.values(serverCollections)) {
    it(`${name}: rejects a fraction or an out-of-range integer, and NUL in text`, () => {
      for (const [key, column] of Object.entries(getTableColumns(table))) {
        const field = schema.shape[key];
        if (!field) continue; // server-only
        const max = INTEGER_MAX[column.getSQLType()];
        if (max !== undefined) {
          expect(field.safeParse(max).success, key).toBe(true);
          expect(field.safeParse(-max).success, key).toBe(true);
          expect(field.safeParse(max + 1).success, key).toBe(false);
          expect(field.safeParse(1.5).success, key).toBe(false);
        }
        // Enum and uuid fields in text columns take no free text, so they can't carry a NUL either.
        if (column.getSQLType() === 'text' && field.safeParse('a').success) {
          expect(field.safeParse('a\u0000b').success, key).toBe(false);
        }
      }
    });
  }
});

describe('presign expiry rules', () => {
  it('defaults to 1h when unset / non-positive / non-finite', () => {
    expect(resolveExpiresIn(undefined)).toBe(PRESIGN_DEFAULT_EXPIRES_IN);
    expect(resolveExpiresIn(0)).toBe(PRESIGN_DEFAULT_EXPIRES_IN);
    expect(resolveExpiresIn(-5)).toBe(PRESIGN_DEFAULT_EXPIRES_IN);
    expect(resolveExpiresIn(NaN)).toBe(PRESIGN_DEFAULT_EXPIRES_IN);
  });
  it('passes through a positive value and clamps to one week', () => {
    expect(resolveExpiresIn(120)).toBe(120);
    expect(resolveExpiresIn(PRESIGN_MAX_EXPIRES_IN + 100)).toBe(PRESIGN_MAX_EXPIRES_IN);
  });
});

describe('constants', () => {
  it('multipart part size is 100 MiB (binary)', () => {
    expect(MULTIPART_PART_SIZE).toBe(104_857_600);
  });
});

describe('error envelope', () => {
  it('AppError factories carry status + code', () => {
    expect(AppError.unauthorized()).toMatchObject({ statusCode: 401, code: 'unauthorized' });
    expect(AppError.invalidCredentials()).toMatchObject({ statusCode: 401, code: 'invalid_credentials' });
    expect(AppError.invalidToken()).toMatchObject({ statusCode: 401, code: 'invalid_token' });
    expect(AppError.notFound()).toMatchObject({ statusCode: 404, code: 'not_found' });
    expect(AppError.s3('boom')).toMatchObject({ statusCode: 502, code: 's3_error' });
  });
  it('errorBody has the { error: { code, message } } shape', () => {
    expect(errorBody('internal', 'x')).toEqual({ error: { code: 'internal', message: 'x' } });
  });
});
