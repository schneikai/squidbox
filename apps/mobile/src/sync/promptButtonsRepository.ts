import {
  DEFAULT_PROMPT_BUTTONS,
  keyBetween,
  movePositions,
  ONE_LIST_PLACEMENT,
  promptButtonCollection,
  type NewPromptButton,
  type PromptButtonRecord,
} from '@squidbox/shared';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIdMap } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';
import { isFirstSyncDone } from './status';

import newRecord from '@/utils/newRecord';

// The chat's prompt buttons (Settings → Assistant → Prompt buttons): the only reader and writer of
// the prompt_buttons table. One list, in the order `(position, id)`; every record it writes has the
// retired placement ONE_LIST_PLACEMENT.

type PromptButtonChanges = Partial<Pick<PromptButtonRecord, 'name' | 'prompt' | 'icon'>>;

const t = schema.promptButtons;
// A seeded default's clock: older than any real write, so every edit of the default wins over it.
const SEED_CLOCK = 1;
const repository = makeRepository<PromptButtonRecord>('prompt_buttons', t);

/** The live buttons, in their order. */
export async function readPromptButtons(db: SyncDb): Promise<PromptButtonRecord[]> {
  const rows = await db.select().from(t).where(isNull(t.deletedAt)).orderBy(asc(t.position), asc(t.id));
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

// The key after the last live button.
async function positionAtEnd(db: SyncDb): Promise<string> {
  const [last] = await db
    .select({ position: t.position })
    .from(t)
    .where(isNull(t.deletedAt))
    .orderBy(desc(t.position), desc(t.id))
    .limit(1);
  return keyBetween(last?.position ?? null, null);
}

/** A new button at the end of the list. */
export async function createPromptButton(db: SyncDb, fields: NewPromptButton): Promise<PromptButtonRecord> {
  return db.transaction(async (tx) => {
    const position = await positionAtEnd(tx);
    const record = newRecord(promptButtonCollection, {}, { ...fields, placement: ONE_LIST_PLACEMENT, position });
    await saveRecords(tx, 'prompt_buttons', t, [record], { isNew: true });
    return record;
  });
}

/** Change a button's name, prompt or icon. */
export async function updatePromptButton(db: SyncDb, id: string, changes: PromptButtonChanges): Promise<void> {
  await db.transaction(async (tx) => {
    const stored = await readPromptButton(tx, id);
    if (!stored) return;
    await saveRecords(tx, 'prompt_buttons', t, [nextVersion<PromptButtonRecord>(stored, changes)], {
      previous: [stored],
    });
  });
}

/** Delete buttons (tombstones, so a deleted default never comes back). */
export function removePromptButton(db: SyncDb, id: string): Promise<void> {
  return repository.remove(db, [id]);
}

/**
 * Move a button right after `afterId` (`null`: first), with one new position between its new
 * neighbours as the database has them (movePositions). Nothing when either is gone.
 */
export async function movePromptButton(db: SyncDb, id: string, afterId: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const live = await readPromptButtons(tx);
    if (!live.some((row) => row.id === id)) return;
    const updates = movePositions(live, id, afterId);
    const changed = live.filter((row) => updates[row.id]).map((row) => nextVersion(row, updates[row.id]));
    await saveRecords(tx, 'prompt_buttons', t, changed, { previous: live });
  });
}

/**
 * Insert each of `defaults` once per library: only after the first full pull (which brings another
 * device's buttons and deletions), and only the defaults whose id the table doesn't hold yet,
 * tombstones included, so a deleted default never comes back and a moved one stays where it is. A
 * default added in a later version reaches a library that already has buttons once, at the end of
 * the list. Their ids are fixed, so two devices that both seed before syncing
 * converge on one row each. A seeded button carries the lowest clock (SEED_CLOCK): a device can seed
 * before this launch's pull has brought another device's deletion or move of that default, and any
 * real edit, tombstone included, then wins over the seed on the server (the push answers
 * `skipped-lww` with the stored row). Returns whether it seeded any.
 */
export async function seedPromptButtons(
  db: SyncDb,
  defaults: readonly NewPromptButton[] = DEFAULT_PROMPT_BUTTONS,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await isFirstSyncDone(tx))) return false;
    const held = await readByIdMap(
      tx,
      t,
      defaults.map((button) => button.id),
    );
    const missing = defaults.filter((button) => !held.has(button.id));
    if (missing.length === 0) return false;
    let position = await positionAtEnd(tx);
    const records = [];
    for (const button of missing) {
      records.push(
        newRecord(
          promptButtonCollection,
          {},
          { ...button, placement: ONE_LIST_PLACEMENT, position, updatedAt: SEED_CLOCK },
        ),
      );
      position = keyBetween(position, null);
    }
    await saveRecords(tx, 'prompt_buttons', t, records, { isNew: true });
    return true;
  });
}
