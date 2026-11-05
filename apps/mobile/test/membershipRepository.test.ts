import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeTestDb } from './helpers/testDb';
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

  it('tombstoneChild takes a contact off every parent and leaves the other contacts', async () => {
    await contactLinks.add(db, { targetType: 'asset', targetId: 'p1' }, ['a', 'b'], newId);
    await contactLinks.add(db, { targetType: 'album', targetId: 'p1' }, ['a'], newId);
    await contactLinks.tombstoneChild(db, 'a');
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

  it('tombstoneParent empties one list and leaves the others', async () => {
    await contactListMembers.add(db, LIST, ['a', 'b'], newId);
    await contactListMembers.add(db, { listId: 'list-2' }, ['a'], newId);
    await contactListMembers.tombstoneParent(db, LIST);
    expect(await liveContactIds('list-1')).toEqual([]);
    expect(await liveContactIds('list-2')).toEqual(['a']);
  });
});
