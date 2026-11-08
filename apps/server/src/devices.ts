import { desc, eq } from 'drizzle-orm';
import type { ClientInfo } from '@squidbox/shared';
import type { Db } from './db/client.js';
import { devices, users } from './db/schema.js';

/**
 * Notes that `userId` made a request from `info`'s install, running its build: the row is made on the
 * first request, then its contract, build and last seen time follow (docs/sync-design.md §15).
 */
export async function recordDevice(db: Db, userId: string, info: ClientInfo, now: Date): Promise<void> {
  await db
    .insert(devices)
    .values({ userId, id: info.device, contract: info.contract, build: info.build, firstSeenAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [devices.userId, devices.id],
      set: { contract: info.contract, build: info.build, lastSeenAt: now },
    });
}

/** Every recorded install with its account's email, the most recently seen first (scripts/devices.ts). */
export function listDevices(db: Db) {
  return db
    .select({
      device: devices.id,
      email: users.email,
      contract: devices.contract,
      build: devices.build,
      firstSeenAt: devices.firstSeenAt,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(devices)
    .innerJoin(users, eq(users.id, devices.userId))
    .orderBy(desc(devices.lastSeenAt));
}
