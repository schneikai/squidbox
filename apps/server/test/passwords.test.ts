import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';

describe('passwords (bcryptjs, Rails-compatible)', () => {
  it('hashes and verifies a password', async () => {
    const digest = await hashPassword('s3cret!');
    expect(digest).toMatch(/^\$2[aby]\$/); // bcrypt format
    expect(await verifyPassword('s3cret!', digest)).toBe(true);
    expect(await verifyPassword('wrong', digest)).toBe(false);
  });

  it('verifies a pre-existing bcrypt digest (imported from Rails)', async () => {
    // A pre-existing $2a$ bcrypt digest of "password" (the format Rails' has_secure_password
    // stores). bcryptjs must verify a digest it didn't itself produce this run.
    const railsDigest = '$2a$10$dOi0JQRYNqiV7SXMWvvjcurilDfz8UUCgdDKQBBdjhzxEb5dJOpJu';
    expect(await verifyPassword('password', railsDigest)).toBe(true);
    expect(await verifyPassword('nope', railsDigest)).toBe(false);
  });
});
