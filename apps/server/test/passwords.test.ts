import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';

describe('passwords (bcryptjs)', () => {
  it('hashes and verifies a password', async () => {
    const digest = await hashPassword('s3cret!');
    expect(digest).toMatch(/^\$2[aby]\$/); // bcrypt format
    expect(await verifyPassword('s3cret!', digest)).toBe(true);
    expect(await verifyPassword('wrong', digest)).toBe(false);
  });

  it('verifies an existing $2a$ bcrypt digest', async () => {
    // A $2a$ digest of "password" produced elsewhere: bcryptjs must verify digests it didn't create.
    const importedDigest = '$2a$10$dOi0JQRYNqiV7SXMWvvjcurilDfz8UUCgdDKQBBdjhzxEb5dJOpJu';
    expect(await verifyPassword('password', importedDigest)).toBe(true);
    expect(await verifyPassword('nope', importedDigest)).toBe(false);
  });
});
