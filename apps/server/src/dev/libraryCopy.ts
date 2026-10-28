import { readFile, writeFile } from 'node:fs/promises';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { neon } from '@neondatabase/serverless';
import { getTableName } from 'drizzle-orm';
import type { PushMutation } from '@squidbox/shared';
import { loadConfig } from '../config.js';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { AppError } from '../errors.js';
import { fullKey, resolveStorage, type StorageLocation } from '../storage/resolver.js';
import { serverCollections } from '../sync/collections.js';
import { pull } from '../sync/pull.js';
import { push } from '../sync/push.js';

// Local dev only. The library-copy account (LIBRARY_COPY_EMAIL) holds a copy of the owner's live
// library, made from the live database (LIVE_DATABASE_URL) the first time the dev client opens it.
// Its files are never copied: their download URLs are signed for the live bucket with
// LIVE_AWS_ACCESS_KEY_ID / LIVE_AWS_SECRET_ACCESS_KEY, for reading only. Nothing here writes to the
// live database or the live bucket: every live query runs in a read-only transaction, the only live
// S3 call is a signed GET, uploads to the copy are refused, and deletes reach only this server's own
// storage, where the copy has no files.

// Where the copy's files live in the live storage, written by the copy and read after a restart.
const LINK_FILE = new URL('../../.library-copy.json', import.meta.url);
const PUSH_BATCH = 500;

let liveS3: S3Client | null = null;
let link: StorageLocation | null = null;

export function isLibraryCopy(user: User): boolean {
  const email = loadConfig().LIBRARY_COPY_EMAIL;
  return Boolean(email) && user.email === email;
}

export function readOnlyLibraryError(): AppError {
  return new AppError(403, 'read_only_library', 'The copy of your library shows your live files and takes no uploads');
}

/**
 * Copies the owner's live library into the copy account, unless the copy holds records already (then
 * it stays as it is). Resolves whether it copied.
 */
export async function copyLiveLibraryIfMissing(db: Db, copyUser: User): Promise<boolean> {
  const { LIVE_DATABASE_URL: liveUrl } = loadConfig();
  if (!liveUrl) throw new AppError(503, 'internal', 'LIVE_DATABASE_URL is not set: start with npm run dev:local');
  const existing = await pull(db, copyUser.id, { limit: 1 });
  if (Object.values(existing.changes).some(({ records }) => records.length > 0)) return false;

  const { owner, records } = await readLiveLibrary(liveUrl);
  const now = Date.now();
  // The persona, instructions and model choices are one record per user, whose id is the user's id.
  const mutations: PushMutation[] = Object.entries(records).flatMap(([collection, rows]) =>
    rows.map((row) => ({
      collection,
      record: { ...row, id: row.id === owner.id ? copyUser.id : row.id, updatedAt: now },
    })),
  );
  for (let i = 0; i < mutations.length; i += PUSH_BATCH) {
    const results = await push(db, copyUser.id, mutations.slice(i, i + PUSH_BATCH));
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) throw new AppError(500, 'internal', `Copy rejected: ${JSON.stringify(rejected[0])}`);
  }

  link = resolveStorage({ id: owner.id, storageBucket: owner.storageBucket }, loadConfig().S3_SHARED_BUCKET);
  await writeFile(LINK_FILE, JSON.stringify(link));
  return true;
}

// The owner (the live account with the `developer` feature) and every record of their library, in
// the wire format of a pull, from one read-only transaction.
async function readLiveLibrary(liveUrl: string) {
  const sql = neon(liveUrl);
  const owners = (await sql.transaction(
    (tx) => [tx`select id, storage_bucket from users where 'developer' = any(features)`],
    { readOnly: true },
  )) as unknown as Array<Array<{ id: string; storage_bucket: string | null }>>;
  const found = owners[0] ?? [];
  if (found.length !== 1) {
    throw new AppError(500, 'internal', `Expected one live account with the developer feature, found ${found.length}`);
  }
  const owner = { id: found[0]!.id, storageBucket: found[0]!.storage_bucket };

  const collections = Object.values(serverCollections);
  const results = (await sql.transaction(
    (tx) =>
      collections.map((col) =>
        tx.query(`select * from ${JSON.stringify(getTableName(col.table))} where user_id = $1`, [owner.id]),
      ),
    { readOnly: true },
  )) as unknown as Array<Array<Record<string, unknown>>>;

  const records: Record<string, Array<Record<string, unknown> & { id: string }>> = Object.fromEntries(
    collections.map((col, index) => [
      col.descriptor.name,
      results[index]!.map((row) =>
        Object.fromEntries(
          Object.entries(col.wireColumns).map(([key, column]) => {
            const value = row[column.name];
            return [key, value === null || value === undefined ? null : column.mapFromDriverValue(value)];
          }),
        ),
      ) as Array<Record<string, unknown> & { id: string }>,
    ]),
  );
  return { owner, records: withoutUnuploadedAssets(records) };
}

// Photos another device hasn't backed up yet have no files to link to, so the copy leaves them out,
// with their places in albums and posts.
function withoutUnuploadedAssets(records: Record<string, Array<Record<string, unknown> & { id: string }>>) {
  const left = new Set(
    (records.assets ?? []).filter((a) => !a.isFileSynced || !a.isThumbnailSynced).map((a) => a.id),
  );
  return Object.fromEntries(
    Object.entries(records).map(([collection, rows]) => [
      collection,
      rows.filter((row) => !left.has(collection === 'assets' ? row.id : (row.assetId as string))),
    ]),
  );
}

/** Read-only URLs for the copy's files, signed for the live bucket. */
export async function liveDownloadUrls(keys: string[], expiresIn: number) {
  const location = await linkedLocation();
  const client = liveS3Client();
  const urls = await Promise.all(
    keys.map(async (key) => ({
      key,
      url: await getSignedUrl(client, new GetObjectCommand({ Bucket: location.bucket, Key: fullKey(location, key) }), {
        expiresIn,
      }),
    })),
  );
  return { urls };
}

async function linkedLocation(): Promise<StorageLocation> {
  if (link) return link;
  try {
    link = JSON.parse(await readFile(LINK_FILE, 'utf8')) as StorageLocation;
    return link;
  } catch {
    throw AppError.s3(
      'The copy of your library has no link to the live files yet: open it from Settings → Dev accounts',
    );
  }
}

function liveS3Client(): S3Client {
  const {
    LIVE_AWS_ACCESS_KEY_ID: accessKeyId,
    LIVE_AWS_SECRET_ACCESS_KEY: secretAccessKey,
    LIVE_AWS_REGION: region,
  } = loadConfig();
  if (!accessKeyId || !secretAccessKey) {
    throw AppError.s3(
      'LIVE_AWS_ACCESS_KEY_ID and LIVE_AWS_SECRET_ACCESS_KEY are not set: start with npm run dev:local',
    );
  }
  liveS3 ??= new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return liveS3;
}
