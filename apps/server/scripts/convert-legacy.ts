/**
 * One-shot server-side legacy import. Downloads the old JSON backups from S3
 * (assets.json / albums.json / posts.json in the user's storage bucket — the same keys the
 * Rails data-backup wrote), maps them old→modern, and imports for one user via the sync push
 * path. The user's device then pulls everything on first login. Idempotent (LWW) — safe to re-run.
 *
 * Run from apps/server, with .env pointed at the TARGET backend (its Postgres + the AWS creds
 * that can read the user's bucket):
 *   CONVERT_USER_EMAIL=me@example.com npm run convert:legacy
 */
import { loadConfig } from '../src/config.js';
import { getDb, closeDb } from '../src/db/client.js';
import { findUserByEmail } from '../src/users.js';
import { resolveStorage } from '../src/storage/resolver.js';
import { getObjectText } from '../src/storage/s3.js';
import { importLegacy } from '../src/convert/legacy.js';
import { remapLegacyIds } from '../src/convert/remap.js';
import { verifyImport } from '../src/convert/verify.js';

const config = loadConfig();
const email = process.env.CONVERT_USER_EMAIL ?? process.env.SEED_USER_EMAIL;
if (!email) throw new Error('Set CONVERT_USER_EMAIL to the account whose S3 backup should be imported');

const db = getDb();
const user = await findUserByEmail(db, email);
if (!user) throw new Error(`User not found: ${email}. Seed the user first (db:seed).`);

// The JSON lives at plain keys in the user's namespace (legacy account → its bucket, prefix '').
const loc = resolveStorage(user, config.S3_SHARED_BUCKET);

async function readMap(name: string): Promise<Record<string, Record<string, unknown>> | undefined> {
  const text = await getObjectText(loc, name);
  if (!text) {
    console.warn(`(skipping ${name} — not found in S3 at ${loc.bucket}/${loc.keyPrefix}${name})`);
    return undefined;
  }
  return JSON.parse(text);
}

console.log(`Importing S3 backup for ${email} from bucket ${loc.bucket} (prefix "${loc.keyPrefix}")…`);

// Canonicalize all ids -> uuids and rewrite references before importing.
const { data, stats } = remapLegacyIds({
  assets: await readMap('assets.json'),
  albums: await readMap('albums.json'),
  posts: await readMap('posts.json'),
});
console.log(
  `Remapped ids: ${stats.assetIds} assets, ${stats.albumIds} albums, ${stats.postIds} posts.`
);
console.log(
  `Dropped dangling refs -> albumAssets:${stats.droppedAlbumAssetRefs} albumPosts:${stats.droppedAlbumPostHistory} assetPosts:${stats.droppedAssetPostHistory} postAssetRefs:${stats.droppedPostAssetRefs} rePostIds:${stats.droppedRePostIds}`
);

const results = await importLegacy(db, user.id, data);

for (const r of results) {
  console.log(`${r.collection}: applied ${r.applied}, skipped ${r.skipped}, rejected ${r.rejected}`);
  if (r.reasons.length) console.log('  rejected sample:', r.reasons.slice(0, 10).join(' | '));
}

console.log('\nVerifying imported data (id formats + referential integrity)…');
const report = await verifyImport(db, user.id);
console.log('counts', report.counts);
for (const s of report.samples) console.log('  spot-check:', s);
if (report.violations.length) {
  console.log(`VIOLATIONS (${report.violations.length}):`);
  for (const v of report.violations) console.log('  -', v);
} else {
  console.log('OK — all ids canonical uuids and all references resolve.');
}

console.log('\nLegacy import complete. Log in on the device to pull it down.');
await closeDb();
