import { randomBytes } from 'node:crypto';
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import { AppError } from '../errors.js';

// Per-device refresh tokens: every device holds its own valid refresh token, and rotation replaces
// only the token that was presented, so device A refreshing never logs out device B.
export const REFRESH_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
// How long a rotated token still answers with its successor: long enough for a lost response to be
// retried, short enough that a stolen predecessor is worthless soon.
export const ROTATION_GRACE_MS = 10 * 60 * 1000;

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

// Validate + rotate atomically: mark the presented (valid, unexpired) token as replaced and issue
// its successor for the same user. For ROTATION_GRACE_MS the presented token stays valid, until
// the successor is first presented, so a refresh whose response was lost, or two concurrent
// refreshes of one token, get the same successor again instead of signing the device out.
// Presenting the successor retires its predecessor. Throws invalid_token when the presented token
// is unknown, expired or retired (a rotation older than the grace counts as retired).
export async function rotateRefreshToken(
  db: Db,
  presented: string,
  now = Date.now(),
): Promise<{ userId: string; token: string }> {
  return db.transaction(async (tx) => {
    const token = newRefreshToken();
    const [rotated] = await tx
      .update(refreshTokens)
      .set({ replacedBy: token, replacedAt: new Date(now) })
      .where(
        and(
          eq(refreshTokens.token, presented),
          isNull(refreshTokens.replacedBy),
          gt(refreshTokens.expiresAt, new Date(now)),
        ),
      )
      .returning({ userId: refreshTokens.userId });
    if (rotated) {
      await tx.insert(refreshTokens).values({
        userId: rotated.userId,
        token,
        expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
      });
      await tx.delete(refreshTokens).where(eq(refreshTokens.replacedBy, presented));
      return { userId: rotated.userId, token };
    }

    // Rotated recently: hand out its successor again while that one is still unpresented and valid.
    const predecessor = alias(refreshTokens, 'predecessor');
    const [successor] = await tx
      .select({ userId: refreshTokens.userId, token: refreshTokens.token })
      .from(refreshTokens)
      .innerJoin(predecessor, eq(predecessor.replacedBy, refreshTokens.token))
      .where(
        and(
          eq(predecessor.token, presented),
          gt(predecessor.replacedAt, new Date(now - ROTATION_GRACE_MS)),
          isNull(refreshTokens.replacedBy),
          gt(refreshTokens.expiresAt, new Date(now)),
        ),
      );
    if (!successor) throw AppError.invalidToken('Invalid or expired refresh token');
    return successor;
  });
}

// Logout: revoke this device's presented refresh token together with its predecessor and
// successor, so neither side of a rotation in flight survives.
export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  const successorOf = db
    .select({ token: refreshTokens.replacedBy })
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token));
  await db
    .delete(refreshTokens)
    .where(
      or(
        eq(refreshTokens.token, token),
        eq(refreshTokens.replacedBy, token),
        inArray(refreshTokens.token, successorOf),
      ),
    );
}
