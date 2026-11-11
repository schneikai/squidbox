import {
  DEFAULT_IDEA_PROMPTS,
  IDEA_SETTING_FIELDS,
  type IdeaSettingFields,
  type IdeaSettingRecord,
  type IdeasKind,
} from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// Post ideas and Repost ideas (Settings → Assistant): the only reader and writer of the
// idea_settings table. One record per user, whose id is the user's id; a null prompt is the built-in
// text (resolveIdeaSettings).

const t = schema.ideaSettings;

const EMPTY_SETTINGS: IdeaSettingFields = Object.freeze({
  postIdeasOn: true,
  repostIdeasOn: true,
  postIdeasPrompt: null,
  repostIdeasPrompt: null,
});

/** The user's idea settings, or null before the first save. */
export async function readIdeaSettings(db: SyncDb, userId: string): Promise<IdeaSettingRecord | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return row ?? null;
}

/** A change to one kind's settings: its switch, its prompt (null for the built-in text), or both. */
export type IdeaSettingChanges = { isOn?: boolean; prompt?: string | null };

/**
 * Saves the user's change to `kind`'s settings, only the fields it names. A prompt equal to the
 * built-in text (trimmed) is stored as null, so it follows a later change of the built-in text.
 */
export function saveIdeaSettings(
  db: SyncDb,
  userId: string,
  kind: IdeasKind,
  { isOn, prompt }: IdeaSettingChanges,
): Promise<void> {
  const fields = IDEA_SETTING_FIELDS[kind];
  const value = prompt == null || prompt.trim() === DEFAULT_IDEA_PROMPTS[kind] ? null : prompt.trim();
  return saveUserRecord(
    db,
    'idea_settings',
    t,
    userId,
    (stored: IdeaSettingFields | null): Partial<IdeaSettingFields> => {
      const current = stored ?? EMPTY_SETTINGS;
      return {
        ...(isOn !== undefined && isOn !== current[fields.isOn] && { [fields.isOn]: isOn }),
        ...(prompt !== undefined && value !== current[fields.prompt] && { [fields.prompt]: value }),
      };
    },
    EMPTY_SETTINGS,
  );
}
