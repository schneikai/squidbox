import { describe, it, expect, beforeEach } from 'vitest';

import { makeContactRecord } from './helpers/factory';
import { makeMeasuredTestDb, type Work } from './helpers/testDb';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';

let db: SyncDb;
let measure: (run: () => Promise<unknown>) => Promise<Work>;
let n: number;
const newId = () => `edge-${++n}`;
const PHOTO = { targetType: 'asset', targetId: 'a1' } as const;

beforeEach(() => {
  ({ db, measure } = makeMeasuredTestDb());
  n = 0;
});

// A contact in list `l1` and on photo `a1`.
async function contactInListAndOnPhoto() {
  const contact = await contacts.create(db, makeContactRecord());
  await contactListMembers.add(db, { listId: 'l1' }, [contact.id], newId);
  await contactLinks.add(db, PHOTO, [contact.id], newId);
  return contact;
}

// The contact's edge row in a membership table.
const edgeOf = async (table: typeof schema.contactListMembers | typeof schema.contactLinks, contactId: string) =>
  (await db.select().from(table)).find((e) => e.contactId === contactId)!;

describe('contactsRepository', () => {
  it('deleting a contact tombstones it, its list memberships and its photo links in one write', async () => {
    const contact = await contactInListAndOnPhoto();
    const other = await contacts.create(db, makeContactRecord());
    await contactLinks.add(db, PHOTO, [other.id], newId);
    await db.delete(schema.outbox);

    const work = await measure(() => contacts.remove(db, [contact.id]));

    const [row] = (await db.select().from(schema.contacts)).filter((c) => c.id === contact.id);
    expect(row!.deletedAt).not.toBeNull();
    expect((await edgeOf(schema.contactListMembers, contact.id)).deletedAt).not.toBeNull();
    expect((await edgeOf(schema.contactLinks, contact.id)).deletedAt).not.toBeNull();
    expect((await edgeOf(schema.contactLinks, other.id)).deletedAt).toBeNull();
    const outbox = await db.select().from(schema.outbox);
    expect(outbox.map((r) => [r.collection, r.op]).sort()).toEqual([
      ['contact_links', 'delete'],
      ['contact_list_members', 'delete'],
      ['contacts', 'delete'],
    ]);
    expect(work.commits).toBe(1);
  });

  // Expected to fail (R1): a restore leaves the edges its delete tombstoned. Waits on decision 1 in
  // docs/reviews/2026-11-12-whole-app.md; once restore revives the edges its contact's delete
  // tombstoned, vitest fails this test and `.fails` goes.
  it.fails('restoring a deleted contact puts it back in its lists and on its photos', async () => {
    const contact = await contactInListAndOnPhoto();
    await contacts.remove(db, [contact.id]);

    await contacts.restore(db, [contact.id]);

    expect((await edgeOf(schema.contactListMembers, contact.id)).deletedAt).toBeNull();
    expect((await edgeOf(schema.contactLinks, contact.id)).deletedAt).toBeNull();
  });
});
