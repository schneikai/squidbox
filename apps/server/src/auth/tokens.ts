import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import { AppError } from '../errors.js';

// Per-device refresh tokens (table, not Rails' single overwritten column) so every device can
// hold its own valid refresh token — rotation replaces only the token that was presented, so
// device A refreshing never logs out device B.
export const REFRESH_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function newRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export async function issueRefreshToken(db: Db, userId: string, now = Date.now()): Promise<string> {
  const token = newRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
  });
  return token;
}

// Validate + rotate atomically: delete the presented (valid, unexpired) token and issue a new
// one for the same user. Throws invalid_token if the presented token is unknown/expired.
export async function rotateRefreshToken(
  db: Db,
  presented: string,
  now = Date.now()
): Promise<{ userId: string; token: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.token, presented), gt(refreshTokens.expiresAt, new Date(now))))
      .returning();
    if (!row) throw AppError.invalidToken('Invalid or expired refresh token');

    const token = newRefreshToken();
    await tx.insert(refreshTokens).values({
      userId: row.userId,
      token,
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    });
    return { userId: row.userId, token };
  });
}

// Logout: revoke just this device's presented refresh token (if any).
export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}
