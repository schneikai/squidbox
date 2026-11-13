import { channelCollection, type Channel, type ChannelRecord } from '@squidbox/shared';

import { nextVersion, tombstone } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { moveInList, positionAtEnd, readInOrder } from './positionedList';
import { readByIdMap } from './readByIds';
import { saveRecords } from './saveRecords';

import newRecord from '@/utils/newRecord';

// The user's channels (Settings → Posts → Channels): the only reader and writer of the channels
// table. One record per catalog channel, under the catalog's fixed `recordId`, in the order
// `(position, id)`.

const t = schema.channels;

/** The live channels, in the user's order. */
export async function readChannels(db: SyncDb): Promise<ChannelRecord[]> {
  return readInOrder(db, t);
}

/**
 * Add a channel at the end of the list: its record is created, or revived when it was deleted (a new
 * position at the end). Nothing when it is in the list already.
 */
export async function addChannel(db: SyncDb, channel: Channel): Promise<void> {
  await db.transaction(async (tx) => {
    const stored = (await readByIdMap(tx, t, [channel.recordId])).get(channel.recordId);
    if (stored && stored.deletedAt === null) return;
    const position = await positionAtEnd(tx, t);
    if (stored) {
      const revived = nextVersion<ChannelRecord>(stored, { deletedAt: null, channelId: channel.id, position });
      await saveRecords(tx, 'channels', t, [revived], { previous: [stored] });
      return;
    }
    const record = newRecord(channelCollection, {}, { id: channel.recordId, channelId: channel.id, position });
    await saveRecords(tx, 'channels', t, [record], { isNew: true });
  });
}

/**
 * Take a channel out of the list (a tombstone; posts on it keep their channel). Written by hand, not
 * with makeRepository's remove: that one tombstones a deleted record again, a write and a push for nothing.
 */
export async function removeChannel(db: SyncDb, channel: Channel): Promise<void> {
  await db.transaction(async (tx) => {
    const stored = (await readByIdMap(tx, t, [channel.recordId])).get(channel.recordId);
    if (!stored || stored.deletedAt !== null) return;
    await saveRecords(tx, 'channels', t, [tombstone(stored)], { previous: [stored] });
  });
}

/** Move a channel right after `afterId` (`null`: first). Nothing when either is gone. */
export function moveChannel(db: SyncDb, id: string, afterId: string | null): Promise<void> {
  return moveInList(db, 'channels', t, id, afterId);
}
