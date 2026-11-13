import { channelById, type Channel } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import { addChannel, moveChannel, readChannels, removeChannel } from '../src/sync/channelsRepository';
import type { SyncDb } from '../src/sync/db/types';

const channel = (id: string): Channel => channelById(id)!;
const order = async (db: SyncDb) => (await readChannels(db)).map((row) => row.channelId);

describe('channelsRepository', () => {
  it('adds a channel at the end of the list, under its fixed id', async () => {
    const db = makeTestDb();
    await addChannel(db, channel('x'));
    await addChannel(db, channel('onlyfans'));
    expect(await order(db)).toEqual(['x', 'onlyfans']);
    expect((await readChannels(db))[0]!.id).toBe(channel('x').recordId);
  });

  it('changes nothing when adding a channel the list has', async () => {
    const db = makeTestDb();
    await addChannel(db, channel('x'));
    await addChannel(db, channel('bluesky'));
    const before = await readChannels(db);
    await addChannel(db, channel('x'));
    expect(await readChannels(db)).toEqual(before);
  });

  it('brings a deleted channel back as its own record, at the end', async () => {
    const db = makeTestDb();
    await addChannel(db, channel('x'));
    await addChannel(db, channel('bluesky'));
    await removeChannel(db, channel('x'));
    expect(await order(db)).toEqual(['bluesky']);
    await addChannel(db, channel('x'));
    expect(await order(db)).toEqual(['bluesky', 'x']);
    expect((await readChannels(db))[1]!.id).toBe(channel('x').recordId);
  });

  it('moves a channel between its new neighbours', async () => {
    const db = makeTestDb();
    for (const id of ['x', 'bluesky', 'threads']) await addChannel(db, channel(id));
    await moveChannel(db, channel('threads').recordId, channel('x').recordId);
    expect(await order(db)).toEqual(['x', 'threads', 'bluesky']);
    await moveChannel(db, channel('bluesky').recordId, null);
    expect(await order(db)).toEqual(['bluesky', 'x', 'threads']);
  });
});
