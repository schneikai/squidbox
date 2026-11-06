import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeMeasuredTestDb, makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';

describe('membershipRepository', () => {
  let db: SyncDb;
  let n: number;
  const newId = () => `edge-${++n}`;
  const LIST = { listId: 'list-1' };

  beforeEach(() => {
    db = makeTestDb();
    n = 0;
  });

  const members = () => db.select().from(schema.contactListMembers);
  const liveContactIds = async (listId: string) =>
    (await members())
      .filter((e) => e.listId === listId && e.deletedAt === null)
      .map((e) => e.contactId)
      .sort();

  it('add skips a contact already in the list and creates the rest', async () => {
    await contactListMembers.add(db, LIST, ['a', 'b'], newId);
    await contactListMembers.add(db, LIST, ['b', 'c'], newId);
    expect(await liveContactIds('list-1')).toEqual(['a', 'b', 'c']);
    expect(await members()).toHaveLength(3);
  });

  it('add after a remove restores the tombstoned edge instead of making a new one', async () => {
    await contactListMembers.add(db, LIST, ['a'], newId);
    await contactListMembers.remove(db, LIST, ['a']);
    expect(await liveContactIds('list-1')).toEqual([]);
    await contactListMembers.add(db, LIST, ['a'], newId);
    const rows = await members();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'edge-1', deletedAt: null });
  });

  it('remove tombstones the edge and syncs it', async () => {
    await contactListMembers.add(db, LIST, ['a'], newId);
    await contactListMembers.remove(db, LIST, ['a']);
    const [edge] = await members();
    expect(edge!.deletedAt).not.toBeNull();
    const outbox = await db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'contact_list_members'));
    expect(outbox).toHaveLength(1);
  });

  it('tombstoneWhere a contact takes it off every parent and leaves the other contacts', async () => {
    await contactLinks.add(db, { targetType: 'asset', targetId: 'p1' }, ['a', 'b'], newId);
    await contactLinks.add(db, { targetType: 'album', targetId: 'p1' }, ['a'], newId);
    await contactLinks.tombstoneWhere(db, { contactId: 'a' });
    const live = (await db.select().from(schema.contactLinks)).filter((e) => e.deletedAt === null);
    expect(live.map((e) => [e.targetType, e.contactId])).toEqual([['asset', 'b']]);
  });

  it('a parent is all its columns: the same id under another target type is another parent', async () => {
    await contactLinks.add(db, { targetType: 'asset', targetId: 'x' }, ['a'], newId);
    await contactLinks.add(db, { targetType: 'post', targetId: 'x' }, ['a'], newId);
    await contactLinks.remove(db, { targetType: 'asset', targetId: 'x' }, ['a']);
    const live = (await db.select().from(schema.contactLinks)).filter((e) => e.deletedAt === null);
    expect(live.map((e) => e.targetType)).toEqual(['post']);
  });

  it("change adds and removes only the given contacts, restoring a removed one's edge", async () => {
    await contactListMembers.add(db, LIST, ['a', 'b', 'd'], newId);
    await contactListMembers.remove(db, LIST, ['d']);
    await contactListMembers.add(db, LIST, ['e'], newId); // another device's add, unseen by the change
    await contactListMembers.change(db, LIST, { added: ['c', 'd'], removed: ['a'] }, newId);
    expect(await liveContactIds('list-1')).toEqual(['b', 'c', 'd', 'e']);
    expect((await members()).filter((e) => e.contactId === 'd')).toMatchObject([{ id: 'edge-3', deletedAt: null }]);
  });

  it('addToEach puts the contacts in every list, a removed one restored, the rest left as they are', async () => {
    await contactListMembers.add(db, LIST, ['a'], newId);
    await contactListMembers.remove(db, LIST, ['a']);
    await contactListMembers.add(db, { listId: 'list-3' }, ['z'], newId);
    await contactListMembers.addToEach(db, [LIST, { listId: 'list-2' }], ['a', 'b'], newId);
    expect(await liveContactIds('list-1')).toEqual(['a', 'b']);
    expect(await liveContactIds('list-2')).toEqual(['a', 'b']);
    expect(await liveContactIds('list-3')).toEqual(['z']);
    expect((await members()).filter((e) => e.listId === 'list-1' && e.contactId === 'a')).toHaveLength(1);
  });

  it('add, change and addToEach read the parent’s edges through its index, never the whole table', async () => {
    const measured = makeMeasuredTestDb();
    const work = await measured.measure(async () => {
      await contactListMembers.add(measured.db, LIST, ['a'], newId);
      await contactListMembers.change(measured.db, LIST, { added: ['b'], removed: ['a'] }, newId);
      await contactListMembers.addToEach(measured.db, [LIST, { listId: 'list-2' }], ['c'], newId);
      await contactLinks.add(measured.db, { targetType: 'post', targetId: 'p' }, ['a'], newId);
    });
    expect(work.fullScans.filter((line) => !line.startsWith('SCAN json_each'))).toEqual([]);
  });

  it('tombstoneWhere a list empties it and leaves the others', async () => {
    await contactListMembers.add(db, LIST, ['a', 'b'], newId);
    await contactListMembers.add(db, { listId: 'list-2' }, ['a'], newId);
    await contactListMembers.tombstoneWhere(db, LIST);
    expect(await liveContactIds('list-1')).toEqual([]);
    expect(await liveContactIds('list-2')).toEqual(['a']);
  });
});
