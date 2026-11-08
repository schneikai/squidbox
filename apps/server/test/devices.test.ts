import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { formatClientInfo, parseClientInfo } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { devices } from '../src/db/schema.js';
import { recordDevice } from '../src/devices.js';
import { db, USER_A, USER_B, useSyncDb } from './helpers/syncDb.js';

const BUILD = 'b8171cf94f0e681b1b1e1489755730698a95789c';
const NEXT_BUILD = 'c'.repeat(40);

describe('the client header', () => {
  it('reads back what was formatted', () => {
    const info = { contract: 3, build: BUILD, device: randomUUID() };
    expect(parseClientInfo(formatClientInfo(info))).toEqual(info);
  });

  it.each([
    ['', 'empty'],
    [`1 ${BUILD.slice(0, 8)} ${randomUUID()}`, 'a short sha'],
    [`one ${BUILD} ${randomUUID()}`, 'a contract that is no number'],
    [`1 ${BUILD} not-a-uuid`, 'a device that is no uuid'],
    [`1 ${BUILD} ${randomUUID()} extra`, 'more than three parts'],
  ])('is unreadable for %j (%s)', (value) => {
    expect(parseClientInfo(value)).toBeNull();
  });
});

// On a real Postgres: run with `npm run test:db`; plain `npm test` skips them.
const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d('recordDevice (Postgres)', () => {
  useSyncDb();
  const rowsOf = (device: string) => db.select().from(devices).where(eq(devices.id, device));

  it('a first request adds the install; a new build updates it and keeps when it was first seen', async () => {
    const device = randomUUID();
    const first = new Date('2026-11-01T10:00:00Z');
    const later = new Date('2026-11-02T10:00:00Z');
    await recordDevice(db, USER_A, { contract: 1, build: BUILD, device }, first);
    await recordDevice(db, USER_A, { contract: 2, build: NEXT_BUILD, device }, later);
    expect(await rowsOf(device)).toEqual([
      { userId: USER_A, id: device, contract: 2, build: NEXT_BUILD, firstSeenAt: first, lastSeenAt: later },
    ]);
  });

  it('two accounts on one install are two rows', async () => {
    const device = randomUUID();
    const now = new Date();
    await recordDevice(db, USER_A, { contract: 1, build: BUILD, device }, now);
    await recordDevice(db, USER_B, { contract: 1, build: BUILD, device }, now);
    expect((await rowsOf(device)).map((row) => row.userId).sort()).toEqual([USER_A, USER_B].sort());
  });
});
