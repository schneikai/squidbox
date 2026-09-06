import bcrypt from 'bcryptjs';

// bcryptjs is hash-compatible with Rails' bcrypt digests, so existing password_digest values
// import and verify unchanged (no forced password reset at cutover).
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, digest: string): Promise<boolean> {
  return bcrypt.compare(plain, digest);
}
