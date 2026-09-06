import { describe, it, expect } from 'vitest';
import {
  resolveExpiresIn,
  PRESIGN_DEFAULT_EXPIRES_IN,
  PRESIGN_MAX_EXPIRES_IN,
  MULTIPART_PART_SIZE,
} from '@squidbox/shared';
import { AppError, errorBody } from '../src/errors.js';

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
