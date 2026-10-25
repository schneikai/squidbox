import { keyBetween, movePositions, type PromptButtonPlacement, type PromptButtonRecord } from '@squidbox/shared';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';

// The chat's prompt buttons (Settings → Assistant → Prompt buttons): the only reader and writer of
// the prompt_buttons table. Each placement has its own order, `(position, id)`.

type NewPromptButton = Pick<PromptButtonRecord, 'id' | 'name' | 'prompt' | 'placement' | 'icon'>;
type PromptButtonChanges = Partial<Pick<PromptButtonRecord, 'name' | 'prompt' | 'placement' | 'icon'>>;

const t = schema.promptButtons;
const repository = makeRepository<PromptButtonRecord>('prompt_buttons', t);

/** The live buttons, by placement, each placement in its order. */
export async function readPromptButtons(db: SyncDb): Promise<PromptButtonRecord[]> {
  const rows = await db
    .select()
    .from(t)
    .where(isNull(t.deletedAt))
    .orderBy(asc(t.placement), asc(t.position), asc(t.id));
  return rows as PromptButtonRecord[];
}

// The key after the last live button of a placement.
async function positionAtEnd(db: SyncDb, placement: PromptButtonPlacement): Promise<string> {
  const [last] = await db
    .select({ position: t.position })
    .from(t)
    .where(and(eq(t.placement, placement), isNull(t.deletedAt)))
    .orderBy(desc(t.position), desc(t.id))
    .limit(1);
  return keyBetween(last?.position ?? null, null);
}

/** A new button at the end of its placement. */
export async function createPromptButton(db: SyncDb, fields: NewPromptButton): Promise<PromptButtonRecord> {
  return db.transaction(async (tx) => {
    const now = Date.now();
    const position = await positionAtEnd(tx, fields.placement);
    const record = { ...fields, position, createdAt: now, updatedAt: now, deletedAt: null };
    await saveRecords(tx, 'prompt_buttons', t, [record], { isNew: true });
    return record;
  });
}

/** Change a button; moved to another placement, it goes to that one's end. */
export async function updatePromptButton(db: SyncDb, id: string, changes: PromptButtonChanges): Promise<void> {
  await db.transaction(async (tx) => {
    const [stored] = await readByIds<PromptButtonRecord>(tx, t, [id]);
    if (!stored) return;
    const placement = changes.placement ?? stored.placement;
    const position = placement === stored.placement ? stored.position : await positionAtEnd(tx, placement);
    await saveRecords(tx, 'prompt_buttons', t, [nextVersion(stored, { ...changes, position })], {
      previous: [stored],
    });
  });
}

/** Delete buttons (tombstones, so a deleted default never comes back). */
export function removePromptButton(db: SyncDb, id: string): Promise<void> {
  return repository.remove(db, [id]);
}

/**
 * Move a button right after `afterId` in its placement (`null`: first), with one new position
 * between its new neighbours as the database has them (movePositions). Nothing when either is gone
 * or they no longer share a placement.
 */
export async function movePromptButton(db: SyncDb, id: string, afterId: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const [moved] = await tx.select().from(t).where(and(eq(t.id, id), isNull(t.deletedAt)));
    if (!moved) return;
    const live = (await tx
      .select()
      .from(t)
      .where(and(eq(t.placement, moved.placement), isNull(t.deletedAt)))
      .orderBy(asc(t.position), asc(t.id))) as PromptButtonRecord[];
    const updates = movePositions(live, id, afterId);
    const changed = live.filter((row) => updates[row.id]).map((row) => nextVersion(row, updates[row.id]));
    await saveRecords(tx, 'prompt_buttons', t, changed, { previous: live });
  });
}

/**
 * Insert `defaults` once per library: only while the table has no rows at all, tombstones included,
 * so deleting every button never brings the defaults back. Their ids are fixed, so two devices that
 * both seed before syncing converge on one row each. Returns whether it seeded.
 */
export async function seedPromptButtons(
  db: SyncDb,
  defaults: Pick<PromptButtonRecord, 'id' | 'name' | 'prompt' | 'placement' | 'icon'>[],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [{ rows }] = await tx.select({ rows: count() }).from(t);
    if (rows > 0) return false;
    const now = Date.now();
    const last = new Map<string, string | null>();
    const records = defaults.map((button) => {
      const position = keyBetween(last.get(button.placement) ?? null, null);
      last.set(button.placement, position);
      return { ...button, position, createdAt: now, updatedAt: now, deletedAt: null };
    });
    await saveRecords(tx, 'prompt_buttons', t, records, { isNew: true });
    return true;
  });
}
