/**
 * Fills the LOCAL backend with a fixed set of mock data for the dev client: stock photos from
 * picsum.photos, albums (including the smart Favorites/Deleted albums) and posts. Re-running
 * resets the account to exactly this set: ids are deterministic and anything else is tombstoned.
 *
 * Run: npm run seed:mock   (from apps/server, with the local stack and `npm run dev` running)
 * Logs in as SEED_USER_EMAIL / SEED_USER_PASSWORD and refuses any non-local API URL.
 */
import { createHash } from 'node:crypto';
import {
  collectionsByName,
  initialKeys,
  type AlbumAssetRecord,
  type AlbumRecord,
  type AssetRecord,
  type PostAssetRecord,
  type PostRecord,
  type PullResponse,
  type PushMutation,
  type PushResponse,
} from '@squidbox/shared';

const API_URL = process.env.MOCK_API_URL ?? `http://localhost:${process.env.PORT ?? 3100}/api/v1`;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

const DAY = 24 * 60 * 60 * 1000;
const FULL_SIZE = 2048;
const THUMBNAIL_SIZE = 1000; // matches the app's createImageThumbnail
// Albums, posts and DELETED_PHOTOS refer to photos by their index in this list.
const PICSUM_IDS = [
  10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25, 27, 28, 29, 36, 37, 39, 42, 43, 49, 50, 53, 54, 57, 58, 63,
  64, 65,
];
const DELETED_PHOTOS = [28, 29];

const ALBUMS: { name: string; photos?: number[]; smartAlbumType?: 'FAVORITES' | 'DELETED' }[] = [
  { name: 'Favorites', smartAlbumType: 'FAVORITES' },
  { name: 'Deleted', smartAlbumType: 'DELETED' },
  { name: 'Summer trip', photos: [0, 1, 2, 3, 4, 5, 6, 7] },
  { name: 'Weekend walks', photos: [8, 9, 10, 11, 12, 13] },
  { name: 'Inspiration', photos: [14, 15, 16, 17, 18, 2, 9] },
  { name: 'To post', photos: [19, 20, 21, 22, 23] },
];

const POSTS: { text: string; photos: number[]; postedDaysAgo: number | null; isFavorite?: boolean }[] = [
  { text: 'First light over the hills ☀️', photos: [0, 1], postedDaysAgo: 40, isFavorite: true },
  { text: 'Lost in the forest for a day 🌲', photos: [8, 9, 10], postedDaysAgo: 32 },
  { text: 'Coffee and a view. That is all.', photos: [14], postedDaysAgo: 21 },
  { text: 'Summer recap, part 1', photos: [2, 3, 4, 5], postedDaysAgo: 12 },
  { text: 'Quiet roads, loud thoughts.', photos: [11], postedDaysAgo: 5, isFavorite: true },
  { text: 'Draft: weekend dump', photos: [19, 20, 21], postedDaysAgo: null },
  { text: 'Draft: which one should I post?', photos: [22, 23], postedDaysAgo: null },
];

if (!email || !password) throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set (see .env.docker)');
if (!['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) {
  throw new Error(`Refusing to seed mock data into a non-local backend: ${API_URL}`);
}

const now = Date.now();
const token = await login(email, password);

const assets: AssetRecord[] = [];
for (const [index, picsumId] of PICSUM_IDS.entries()) {
  assets.push(await createPhotoAsset(index, picsumId));
  console.log(`Uploaded photo ${index + 1}/${PICSUM_IDS.length}`);
}
const assetAt = (index: number) => assets[index]!;

const albums: AlbumRecord[] = ALBUMS.map((album, index) => ({
  ...baseRecord(`album:${index}`, now - (ALBUMS.length - index) * DAY),
  name: album.name,
  isFavorite: index === 2,
  archivedAt: null,
  showInPostSuggestionsAfter: null,
  oldCollectionName: null,
  notes: null,
  sortOrder: null,
  smartAlbumType: album.smartAlbumType ?? null,
}));

const albumAssets: AlbumAssetRecord[] = ALBUMS.flatMap((album, albumIndex) => {
  const photos = album.photos ?? [];
  const positions = initialKeys(photos.length);
  return photos.map((photo, i) => ({
    ...baseRecord(`album:${albumIndex}:asset:${photo}`, now),
    albumId: albums[albumIndex]!.id,
    assetId: assetAt(photo).id,
    position: positions[i]!,
  }));
});

const posts: PostRecord[] = POSTS.map((post, index) => {
  const postedAt = post.postedDaysAgo === null ? null : now - post.postedDaysAgo * DAY;
  return {
    ...baseRecord(`post:${index}`, postedAt ?? now - index * DAY),
    text: post.text,
    isFavorite: post.isFavorite ?? false,
    postedAt,
    rePostId: null,
    isIgnoredForRepost: false,
    suggestRepostAt: postedAt === null ? 0 : postedAt + 90 * DAY,
    hasBeenReposted: false,
  };
});

const postAssets: PostAssetRecord[] = POSTS.flatMap((post, postIndex) => {
  const positions = initialKeys(post.photos.length);
  return post.photos.map((photo, i) => ({
    ...baseRecord(`post:${postIndex}:asset:${photo}`, now),
    postId: posts[postIndex]!.id,
    assetId: assetAt(photo).id,
    position: positions[i]!,
  }));
});

const mockRecords: Record<string, { id: string }[]> = {
  assets,
  albums,
  album_assets: albumAssets,
  posts,
  post_assets: postAssets,
};
const mutations = [...toMutations(mockRecords), ...(await tombstonesForOtherRecords(mockRecords))];
await push(mutations);

console.log(
  `Mock data ready: ${assets.length} photos, ${albums.length} albums, ${posts.length} posts` +
    ` (${mutations.length} records pushed).`
);

async function createPhotoAsset(index: number, picsumId: number): Promise<AssetRecord> {
  const { width, height } = (await fetchJson(`https://picsum.photos/id/${picsumId}/info`)) as {
    width: number;
    height: number;
  };
  const full = fitWithin(width, height, FULL_SIZE);
  const thumbnail = fitWithin(width, height, THUMBNAIL_SIZE);
  const record = baseRecord(`asset:${picsumId}`, now - index * 2.5 * DAY);
  const filename = `${record.id}.jpg`;
  const thumbnailFilename = `${record.id}thumb.jpg`;

  const file = await downloadPhoto(picsumId, full);
  await upload(filename, file);
  await upload(thumbnailFilename, await downloadPhoto(picsumId, thumbnail));

  return {
    ...record,
    deletedAt: DELETED_PHOTOS.includes(index) ? now : null,
    mediaLibraryAssetId: `mock-${picsumId}`,
    mediaType: 'photo',
    width: full.width,
    height: full.height,
    fileSize: file.length,
    duration: null,
    filename,
    thumbnailFilename,
    isFavorite: index % 4 === 0,
    notes: index % 7 === 3 ? 'Mock note: try a crop for the next post.' : null,
    oldFileId: null,
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
  };
}

function baseRecord(seed: string, createdAt: number) {
  return { id: mockUuid(seed), createdAt, updatedAt: now, deletedAt: null };
}

// Stable UUID (v5 layout) per seed, so re-runs overwrite the same records.
function mockUuid(seed: string): string {
  const hex = createHash('sha1').update(`squidbox-mock:${seed}`).digest('hex');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function toMutations(recordsByCollection: Record<string, object[]>): PushMutation[] {
  return Object.entries(recordsByCollection).flatMap(([collection, records]) =>
    records.map((record) => ({ collection, record: collectionsByName[collection]!.schema.parse(record) }))
  );
}

async function tombstonesForOtherRecords(keep: Record<string, { id: string }[]>): Promise<PushMutation[]> {
  const keepIds = new Set(Object.values(keep).flatMap((records) => records.map((r) => r.id)));
  const tombstones: PushMutation[] = [];
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const page = (await api('/sync/pull', { cursor, limit: 1000 })) as PullResponse;
    for (const [collection, { records }] of Object.entries(page.changes)) {
      for (const record of records) {
        if (keepIds.has(record.id as string) || record.deletedAt) continue;
        tombstones.push({ collection, record: { ...record, deletedAt: now, updatedAt: now } });
      }
    }
    cursor = page.cursor;
    hasMore = page.hasMore;
  }
  return tombstones;
}

async function push(mutations: PushMutation[]): Promise<void> {
  for (let i = 0; i < mutations.length; i += 500) {
    const { results } = (await api('/sync/push', { mutations: mutations.slice(i, i + 500) })) as PushResponse;
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) throw new Error(`Push rejected: ${JSON.stringify(rejected.slice(0, 3))}`);
  }
}

async function login(email: string, password: string): Promise<string> {
  const { accessToken } = (await request('/auth/login', { method: 'POST', body: { email, password } })) as {
    accessToken: string;
  };
  return accessToken;
}

function api(path: string, body: unknown): Promise<unknown> {
  return request(path, { method: 'POST', body, token });
}

async function request(
  path: string,
  { method, body, token }: { method: string; body: unknown; token?: string }
): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
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

async function downloadPhoto(picsumId: number, { width, height }: { width: number; height: number }) {
  const res = await fetch(`https://picsum.photos/id/${picsumId}/${width}/${height}.jpg`);
  if (!res.ok) throw new Error(`Download of picsum photo ${picsumId} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}
