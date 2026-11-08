/**
 * Records a sample client database for today's last client migration (docs/sync-design.md §15):
 * test/fixtures/client-db/<NNNN>.json, every table's rows by column name, which
 * test/clientDbUpgrade.e2e.test.ts migrates to the schema of every later build and pushes to today's
 * server. Written once per migration, never rewritten: run by `npm run contract:record` at the repo
 * root, it says so and leaves an existing file.
 *
 * One record of every collection made through today's repositories, nothing synced: an edit after a
 * create, one tombstone, one purge, and the owner of the library.
 */
import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { purgeAssets } from '../src/sync/assetsRepository';
import { clientCollectionTables } from '../src/sync/clientCollections';
import { createDb } from '../src/sync/db/driver';
import journal from '../src/sync/db/migrations/meta/_journal.json';
import { makeRepository } from '../src/sync/repository';
import { setOwner } from '../src/sync/status';
import { makeAlbumRecord, makeAssetRecord, makeContactRecord, makePostRecord } from '../test/helpers/factory';
import { betterSqliteExecutor, openMigrated } from '../test/helpers/testDb';

const FIXTURES = fileURLToPath(new URL('../test/fixtures/client-db/', import.meta.url));
const NOW = 1_790_000_000_000; // the records' clock: before the e2e server's, so nothing is clamped
const OWNER = '6f1d6c1e-2b9a-4c3e-9d8f-0a1b2c3d4e5f';
// Fixed ids, so the file reads the same wherever it is made.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ASSET = id(1);
const PURGED = id(2);
const ALBUM = id(3);
const POST = id(4);
const CONTACT = id(5);
const LIST = id(6);
const FAVORITE = id(7);

// One record of each collection, in an order that creates what an edge names first.
const records: Record<string, Record<string, unknown>[]> = {
  assets: [
    makeAssetRecord({ id: ASSET, filename: 'trail.jpg', thumbnailFilename: 'trail-t.jpg', tags: ['hiking'] }),
    makeAssetRecord({ id: PURGED, filename: 'blurry.jpg', thumbnailFilename: 'blurry-t.jpg', deletedAt: NOW }),
  ],
  albums: [makeAlbumRecord({ id: ALBUM, name: 'Alps 2026', position: 'a0' })],
  posts: [makePostRecord({ id: POST, text: 'Sunrise over the ridge', suggestRepostAt: NOW })],
  album_assets: [{ id: id(10), albumId: ALBUM, assetId: ASSET, position: 'a0', deletedAt: null }],
  post_assets: [{ id: id(11), postId: POST, assetId: ASSET, position: 'a0', deletedAt: null }],
  personas: [{ id: OWNER, aboutYou: 'Hiker', contentTags: ['outdoors'], tone: 'calm', rules: [], deletedAt: null }],
  prompt_buttons: [
    {
      id: id(12),
      name: 'Shorter',
      prompt: 'Make it shorter',
      placement: 'post',
      icon: null,
      position: 'a0',
      deletedAt: null,
    },
  ],
  favorites: [
    { id: FAVORITE, text: 'Golden hour on the lake', deletedAt: null },
    { id: id(13), text: 'Gone tomorrow', deletedAt: null },
  ],
  instructions: [{ id: OWNER, writing: 'Write short.', visionTagging: null, moreLikeThis: null, deletedAt: null }],
  model_choices: [{ id: OWNER, writingModel: { id: 'model-a', name: 'Model A' }, visionModel: null, deletedAt: null }],
  contacts: [makeContactRecord({ id: CONTACT, name: 'Trail buddy', avatarFilename: 'avatar-buddy.jpg' })],
  contact_lists: [{ id: LIST, name: 'Hiking crew', notes: null, deletedAt: null }],
  contact_list_members: [{ id: id(14), listId: LIST, contactId: CONTACT, deletedAt: null }],
  contact_links: [{ id: id(15), contactId: CONTACT, targetType: 'asset', targetId: ASSET, deletedAt: null }],
  contact_settings: [{ id: OWNER, pinnedListId: LIST, pinnedAt: NOW, deletedAt: null }],
};

// Every table's rows by column name, sync_log aside (a run's history, nothing to upgrade).
function dump(sqlite: Database.Database): Record<string, Record<string, unknown>[]> {
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as { name: string }[];
  return Object.fromEntries(
    tables
      .filter(({ name }) => name !== 'sync_log')
      .map(({ name }) => [
        name,
        sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() as Record<string, unknown>[],
      ]),
  );
}

async function main() {
  const last = journal.entries.at(-1)!;
  const file = `${FIXTURES}${String(last.idx).padStart(4, '0')}.json`;
  if (existsSync(file)) {
    console.log(`The sample client database for ${last.tag} is recorded: ${file}`);
    return;
  }
  Date.now = () => NOW;
  const sqlite = openMigrated();
  const db = createDb(betterSqliteExecutor(sqlite));
  await setOwner(db, { kind: 'account', serverId: 'server', userId: OWNER, email: 'owner@example.com' });
  for (const [name, list] of Object.entries(records)) {
    const repository = makeRepository(name, clientCollectionTables[name]!);
    for (const record of list) await repository.create(db, { ...record, createdAt: NOW, updatedAt: NOW } as never);
  }
  Date.now = () => NOW + 1000;
  await makeRepository('assets', clientCollectionTables.assets!).update(db, ASSET, { notes: 'Edited after' });
  await makeRepository('favorites', clientCollectionTables.favorites!).remove(db, [id(13)]);
  await purgeAssets(db, [PURGED]);

  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ migration: last.tag, tables: dump(sqlite) }, null, 1)}\n`);
  console.log(`Recorded the sample client database for ${last.tag}: ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
