import bcrypt from 'bcryptjs';

// bcryptjs verifies standard bcrypt digests ($2a$/$2b$), including imported password_digest values.
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, digest: string): Promise<boolean> {
  return bcrypt.compare(plain, digest);
}
