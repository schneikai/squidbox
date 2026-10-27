import {
  DEFAULT_PROMPT_BUTTONS,
  keyBetween,
  movePositions,
  promptButtonCollection,
  type NewPromptButton,
  type PromptButtonPlacement,
  type PromptButtonRecord,
} from '@squidbox/shared';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';
import { isFirstSyncDone } from './status';

import newRecord from '@/utils/newRecord';

// The chat's prompt buttons (Settings → Assistant → Prompt buttons): the only reader and writer of
// the prompt_buttons table. Each placement has its own order, `(position, id)`.

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

/** How many live buttons there are. */
export async function countPromptButtons(db: SyncDb): Promise<number> {
  const [{ buttons }] = await db.select({ buttons: count() }).from(t).where(isNull(t.deletedAt));
  return buttons;
}

/** One live button, or null when it's gone (deleted, here or on another device). */
export async function readPromptButton(db: SyncDb, id: string): Promise<PromptButtonRecord | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), isNull(t.deletedAt)));
  return (row as PromptButtonRecord | undefined) ?? null;
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
    const record = newRecord(
      promptButtonCollection,
      {},
      { ...fields, position: await positionAtEnd(tx, fields.placement) },
    );
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
    const moved = await readPromptButton(tx, id);
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
 * Insert each of `defaults` once per library: only after the first full pull (which brings another
 * device's buttons and deletions), and only the defaults whose id the table doesn't hold yet,
 * tombstones included, so a deleted default never comes back and one moved to another placement stays
 * where it is. A default added in a later version reaches a library that already has buttons once,
 * at the end of its placement. Their ids are fixed, so two devices that both seed before syncing
 * converge on one row each. Returns whether it seeded any.
 */
export async function seedPromptButtons(
  db: SyncDb,
  defaults: readonly NewPromptButton[] = DEFAULT_PROMPT_BUTTONS,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await isFirstSyncDone(tx))) return false;
    const held = await tx
      .select({ id: t.id })
      .from(t)
      .where(
        inArray(
          t.id,
          defaults.map((button) => button.id),
        ),
      );
    const heldIds = new Set(held.map((row) => row.id));
    const missing = defaults.filter((button) => !heldIds.has(button.id));
    if (missing.length === 0) return false;
    const last = new Map<string, string>();
    const records = [];
    for (const button of missing) {
      const before = last.get(button.placement);
      const position = before ? keyBetween(before, null) : await positionAtEnd(tx, button.placement);
      last.set(button.placement, position);
      records.push(newRecord(promptButtonCollection, {}, { ...button, position }));
    }
    await saveRecords(tx, 'prompt_buttons', t, records, { isNew: true });
    return true;
  });
}
