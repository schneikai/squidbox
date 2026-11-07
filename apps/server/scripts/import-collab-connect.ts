/**
 * Imports Collab Connect's contacts, lists and contact photos into a Squidbox account, once
 * (collabConnectPlan.ts says what maps to what). It goes through the API as the account, like the app:
 * the photos are uploaded first, then the records are pushed, so every device pulls them like an edit
 * made on another device. Running it again changes nothing that was imported.
 *
 * The backup is Collab Connect's "Backup App Data": `app_data.json` and `app_avatars/` in its S3
 * bucket. With COLLAB_AWS_ACCESS_KEY_ID, COLLAB_AWS_SECRET_ACCESS_KEY and COLLAB_AWS_REGION set and no
 * `app_data.json` in the folder yet, the script downloads them there first. Without --apply nothing
 * is written to the account: it prints what it would do.
 *
 * Run from apps/server:
 *   IMPORT_API_URL=https://… IMPORT_EMAIL=me@example.com IMPORT_PASSWORD=… \
 *     npm run import:collab-connect -- <backup folder> [--apply]
 * IMPORT_API_URL defaults to the local server.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import {
  chunk,
  type ContactListMemberRecord,
  type ContactListRecord,
  type ContactRecord,
  type PullResponse,
  type PushMutation,
  type PushResponse,
} from '@squidbox/shared';
import { collabConnectBackupSchema, planCollabConnectImport, type ImportPlan } from './collabConnectPlan.js';

const API_URL = process.env.IMPORT_API_URL ?? `http://localhost:${process.env.PORT ?? 3100}/api/v1`;
const AVATAR_SIZE = 512; // as the app makes them (makeAvatarAsync)
const AVATAR_QUALITY = 80;
const PUSH_BATCH = 200; // well under the push's body and mutation limits
const UPLOADS_AT_ONCE = 2; // the upload route takes 4 per user

const [dir, mode] = process.argv.slice(2);
const email = process.env.IMPORT_EMAIL;
const password = process.env.IMPORT_PASSWORD;
if (!dir || (mode && mode !== '--apply') || !email || !password) {
  throw new Error('Usage: IMPORT_EMAIL=… IMPORT_PASSWORD=… import:collab-connect <backup folder> [--apply]');
}

await downloadBackupIfMissing(dir);
const backup = collabConnectBackupSchema.parse(JSON.parse(await readFile(join(dir, 'app_data.json'), 'utf8')));
const avatarPath = (filename: string) => join(dir, 'app_avatars', filename);

const { avatars, damaged } = await makeAvatars();
const token = await login(email, password);
const plan = planCollabConnectImport(backup, await pullContacts(), {
  now: Date.now(),
  hasAvatar: (filename) => avatars.has(filename),
});
printSummary(plan);

if (mode === '--apply') {
  const withPhoto = plan.contacts.filter((entry) => entry.avatarFrom);
  let uploaded = 0;
  for (const group of chunk(withPhoto, UPLOADS_AT_ONCE)) {
    await Promise.all(group.map(({ record, avatarFrom }) => upload(record.avatarFilename!, avatars.get(avatarFrom!)!)));
    uploaded += group.length;
    if (uploaded % 100 < UPLOADS_AT_ONCE) console.log(`Uploaded ${uploaded}/${withPhoto.length} photos`);
  }

  const mutations: PushMutation[] = [
    ...plan.contacts.map(({ record, fields }) => ({ collection: 'contacts', record, ...(fields && { fields }) })),
    ...plan.lists.map((record) => ({ collection: 'contact_lists', record })),
    ...plan.members.map((record) => ({ collection: 'contact_list_members', record })),
  ];
  const notApplied = [];
  for (const batch of chunk(mutations, PUSH_BATCH)) {
    const { results } = (await api('/sync/push', { mutations: batch })) as PushResponse;
    notApplied.push(...results.filter((result) => result.status !== 'applied'));
  }
  console.log(`\nApplied ${mutations.length - notApplied.length} of ${mutations.length} writes`);
  for (const result of notApplied) console.log(JSON.stringify({ ...result, current: undefined }));
}

function printSummary({ contacts, lists, members, report }: ImportPlan): void {
  const target = mode === '--apply' ? API_URL : `${API_URL} (dry run, nothing written)`;
  console.log(`Collab Connect → ${email} on ${target}`);
  console.log(`Backup: ${backup.contacts.length} contacts, ${backup.lists.length} lists`);
  console.log(`Already imported: ${report.alreadyImported}`);
  console.log(`New contacts: ${report.newContacts}, with a photo: ${contacts.filter((c) => c.avatarFrom).length}`);
  console.log(`Merged by X handle: ${report.merged.length}`);
  for (const { name, into, existing } of report.merged)
    console.log(`  ${name} → ${into}${existing ? ' (already in Squidbox)' : ''}`);
  console.log(`New lists: ${lists.length} (${lists.map((list) => list.name).join(', ')})`);
  if (report.mergedLists.length > 0) console.log(`Lists merged by name: ${report.mergedLists.join(', ')}`);
  console.log(`New list memberships: ${members.length}`);
  if (report.unknownMembers > 0)
    console.log(`Memberships of contacts no longer in the backup, skipped: ${report.unknownMembers}`);
  if (report.notesKept.length > 0)
    console.log(`Notes kept where a merged contact had other notes: ${report.notesKept.join(', ')}`);
  if (report.missingAvatars.length > 0)
    console.log(`Photos missing from the backup: ${report.missingAvatars.join(', ')}`);
  if (damaged.length > 0)
    console.log(`Photos cut off in the backup, imported as far as they go: ${damaged.join(', ')}`);
  if (report.cut.length > 0) console.log(`Cut to the limit: ${report.cut.join(', ')}`);
}

/**
 * Every photo of the backup as the app makes them: the centre square, at most 512 px, as a JPEG. A
 * photo the backup holds only part of (`damaged`, by contact name) is kept as far as it goes; one that
 * can't be read at all is left out, so its contact comes without a photo.
 */
async function makeAvatars(): Promise<{ avatars: Map<string, Buffer>; damaged: string[] }> {
  const avatars = new Map<string, Buffer>();
  const damaged: string[] = [];
  for (const contact of backup.contacts) {
    const filename = contact.avatarFilename;
    if (!filename || avatars.has(filename) || !existsSync(avatarPath(filename))) continue;
    const input = await readFile(avatarPath(filename));
    const convert = (failOn: 'warning' | 'none') =>
      sharp(input, { failOn })
        .rotate()
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: AVATAR_QUALITY })
        .toBuffer();
    const jpeg = await convert('warning').catch(async () => {
      damaged.push(contact.name);
      return convert('none').catch(() => null);
    });
    if (jpeg) avatars.set(filename, jpeg);
  }
  return { avatars, damaged };
}

// The account's contacts, lists and memberships, tombstones included.
async function pullContacts() {
  const found = {
    contacts: [] as ContactRecord[],
    lists: [] as ContactListRecord[],
    members: [] as ContactListMemberRecord[],
  };
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const page = (await api('/sync/pull', { cursor, limit: 1000 })) as PullResponse;
    found.contacts.push(...((page.changes.contacts?.records ?? []) as ContactRecord[]));
    found.lists.push(...((page.changes.contact_lists?.records ?? []) as ContactListRecord[]));
    found.members.push(...((page.changes.contact_list_members?.records ?? []) as ContactListMemberRecord[]));
    cursor = page.cursor;
    hasMore = page.hasMore;
  }
  return found;
}

async function downloadBackupIfMissing(folder: string): Promise<void> {
  if (existsSync(join(folder, 'app_data.json'))) return;
  const { COLLAB_AWS_ACCESS_KEY_ID, COLLAB_AWS_SECRET_ACCESS_KEY, COLLAB_AWS_REGION } = process.env;
  if (!COLLAB_AWS_ACCESS_KEY_ID || !COLLAB_AWS_SECRET_ACCESS_KEY || !COLLAB_AWS_REGION) {
    throw new Error(`No app_data.json in ${folder}, and no COLLAB_AWS_* keys to download it with`);
  }
  const s3 = new S3Client({
    region: COLLAB_AWS_REGION,
    credentials: { accessKeyId: COLLAB_AWS_ACCESS_KEY_ID, secretAccessKey: COLLAB_AWS_SECRET_ACCESS_KEY },
  });
  const bucket = 'collab-connect';
  const get = async (key: string) => {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await Body!.transformToByteArray());
  };
  const keys: string[] = [];
  let next: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: 'app_avatars/', ContinuationToken: next }),
    );
    keys.push(...(page.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : [])));
    next = page.NextContinuationToken;
  } while (next);
  await mkdir(join(folder, 'app_avatars'), { recursive: true });
  for (const group of chunk(keys, 20))
    await Promise.all(group.map(async (key) => writeFile(join(folder, key), await get(key))));
  // The data last, so a folder with app_data.json has all its photos.
  await writeFile(join(folder, 'app_data.json'), await get('app_data.json'));
  console.log(`Downloaded the backup and ${keys.length} photos to ${folder}`);
}

async function login(loginEmail: string, loginPassword: string): Promise<string> {
  const { accessToken } = (await request('/auth/login', { email: loginEmail, password: loginPassword })) as {
    accessToken: string;
  };
  return accessToken;
}

function api(path: string, body: unknown): Promise<unknown> {
  return request(path, body, token);
}

async function request(path: string, body: unknown, bearer?: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upload(key: string, bytes: Buffer): Promise<void> {
  const res = await fetch(`${API_URL}/assets/upload/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Upload of ${key} failed: ${res.status} ${await res.text()}`);
}
