import { DEFAULT_IDEA_PROMPTS, resolveIdeaSettings } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { readIdeaSettings, saveIdeaSettings } from '../src/sync/ideaSettingsRepository';
import { clearOutboxRows } from '../src/sync/outbox';

const USER = '6f1c1c39-6c1c-4a36-9d0e-2d6c1ad4e0f2';

const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'idea_settings'));

describe('ideaSettingsRepository', () => {
  it('resolves to on and the built-in prompts before the first save', async () => {
    const db = makeTestDb();
    expect(resolveIdeaSettings(await readIdeaSettings(db, USER))).toEqual({
      post: { isOn: true, prompt: DEFAULT_IDEA_PROMPTS.post },
      repost: { isOn: true, prompt: DEFAULT_IDEA_PROMPTS.repost },
    });
  });

  it('saves a switch alone, sending only its field', async () => {
    const db = makeTestDb();
    await saveIdeaSettings(db, USER, 'repost', { isOn: false });
    expect(resolveIdeaSettings(await readIdeaSettings(db, USER))).toMatchObject({
      post: { isOn: true },
      repost: { isOn: false },
    });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['repostIdeasOn']);
  });

  it('stores a prompt equal to the built-in text as null, and writes nothing when that changes nothing', async () => {
    const db = makeTestDb();
    await saveIdeaSettings(db, USER, 'post', { prompt: ' Three short captions. ' });
    expect((await readIdeaSettings(db, USER))!.postIdeasPrompt).toBe('Three short captions.');
    await clearOutboxRows(db, 'idea_settings', [USER]);
    await saveIdeaSettings(db, USER, 'post', { prompt: `${DEFAULT_IDEA_PROMPTS.post}\n` });
    expect((await readIdeaSettings(db, USER))!.postIdeasPrompt).toBeNull();
    await clearOutboxRows(db, 'idea_settings', [USER]);
    await saveIdeaSettings(db, USER, 'post', { prompt: null });
    expect(await outbox(db)).toHaveLength(0);
  });
});
