/**
 * Fills the LOCAL backend with a fixed set of mock data for the dev client: stock photos from
 * picsum.photos, stock videos with music from mixkit.co (all free to use, baked into
 * scripts/mock-videos by bake-mock-videos.sh), albums (including the smart Favorites/Deleted albums)
 * and posts, all by one guy who posts his outdoor photos on Bluesky, and his assistant setup: Writing
 * as you, the prompt buttons (the app's defaults in his words, and one more), Favorites and the
 * Instructions, left on the app's defaults. Re-running resets the account to exactly this set: ids
 * are deterministic and anything else in these collections is tombstoned.
 *
 * Run: npm run seed:mock   (from apps/server, with the local stack and `npm run dev` running)
 *      npm run seed:mock -- --assets 50000   (pad the library to that size, for performance tests:
 *                                              the extra assets reuse the mock media's files)
 * Logs in as SEED_USER_EMAIL / SEED_USER_PASSWORD and refuses any non-local API URL.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  collectionsByName,
  DEFAULT_PROMPT_BUTTONS,
  initialKeys,
  keyBetween,
  type AlbumAssetRecord,
  type AlbumRecord,
  type AssetRecord,
  type FavoriteRecord,
  type InstructionRecord,
  type NewPromptButton,
  type PersonaRecord,
  type PromptButtonRecord,
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
const MOCK_VIDEOS = new URL('./mock-videos/', import.meta.url);
// Mixkit clip ids, each baked into scripts/mock-videos.
type MockMedia = ({ picsum: number } | { video: number }) & { deleted?: boolean };

// Newest first, landscape and portrait photos mixed with videos. Albums and posts refer to media by
// their index in this list; `deleted` ones are in the Deleted album.
const MEDIA: MockMedia[] = [
  { picsum: 10 },
  { picsum: 11 },
  { picsum: 195 },
  { picsum: 13 },
  { video: 808 },
  { picsum: 14 },
  { picsum: 260 },
  { picsum: 15 },
  { picsum: 16 },
  { picsum: 520 },
  { picsum: 17 },
  { video: 1183 },
  { picsum: 18 },
  { picsum: 613 },
  { picsum: 19 },
  { picsum: 20 },
  { picsum: 638 },
  { picsum: 22 },
  { video: 4646 },
  { picsum: 24 },
  { picsum: 722 },
  { picsum: 25 },
  { picsum: 27 },
  { picsum: 735 },
  { picsum: 28 },
  { video: 1197 },
  { picsum: 29 },
  { picsum: 776 },
  { picsum: 36 },
  { picsum: 37 },
  { picsum: 842 },
  { picsum: 39 },
  { video: 529 },
  { picsum: 42 },
  { picsum: 870 },
  { picsum: 43 },
  { picsum: 49 },
  { picsum: 873 },
  { picsum: 50 },
  { video: 1214 },
  { picsum: 53 },
  { picsum: 1003 },
  { picsum: 54 },
  { picsum: 57 },
  { picsum: 1065 },
  { picsum: 58 },
  { video: 4132 },
  { picsum: 63 },
  { picsum: 64, deleted: true },
  { picsum: 65, deleted: true },
  { video: 1164 },
];
const assetsFlag = process.argv.indexOf('--assets');
const ASSET_COUNT = assetsFlag === -1 ? MEDIA.length : Number(process.argv[assetsFlag + 1]);

const ALBUMS: { name: string; media?: number[]; smartAlbumType?: 'FAVORITES' | 'DELETED' }[] = [
  { name: 'Favorites', smartAlbumType: 'FAVORITES' },
  { name: 'Deleted', smartAlbumType: 'DELETED' },
  { name: 'Summer trip', media: [0, 1, 2, 3, 5, 6, 7, 8, 11, 25] },
  { name: 'Weekend walks', media: [14, 15, 16, 17, 19, 20, 32] },
  { name: 'Inspiration', media: [24, 26, 27, 28, 29, 30, 31, 3, 15, 18] },
  { name: 'To post', media: [33, 34, 35, 36, 37, 38, 40, 4] },
];

const POSTS: { text: string; media: number[]; postedDaysAgo: number | null; isFavorite?: boolean }[] = [
  { text: 'First light over the hills ☀️', media: [0, 1], postedDaysAgo: 40, isFavorite: true },
  { text: 'Lost in the forest for a day 🌲', media: [14, 15, 17, 32], postedDaysAgo: 32 },
  { text: 'Coffee and a view. That is all.', media: [4, 33], postedDaysAgo: 21 },
  { text: 'Summer recap, part 1', media: [3, 5, 7, 8, 11], postedDaysAgo: 12 },
  { text: 'Quiet roads, loud thoughts.', media: [19], postedDaysAgo: 5, isFavorite: true },
  { text: 'Draft: weekend dump', media: [35, 36, 37], postedDaysAgo: null },
  { text: 'Draft: which one should I post?', media: [38, 40], postedDaysAgo: null },
  { text: 'Golden hour, again 🌅', media: [2, 6], postedDaysAgo: 45 },
  { text: 'Road snacks ranked', media: [25], postedDaysAgo: 75 },
  { text: '', media: [11], postedDaysAgo: 105 },
  { text: 'That one perfect beach day', media: [5, 7], postedDaysAgo: 135 },
  { text: 'Packing light, mostly', media: [0], postedDaysAgo: 165 },
  { text: 'Sunburn worth it', media: [8], postedDaysAgo: 195 },
  { text: 'Back to the hills', media: [1, 2], postedDaysAgo: 225 },
  { text: 'Tiny town, big skies', media: [6], postedDaysAgo: 255 },
  { text: 'Throwback to the first trip', media: [25, 11], postedDaysAgo: 290 },
  { text: 'Wish I had stayed longer', media: [5], postedDaysAgo: 320 },
  { text: 'Where it all started', media: [0, 8], postedDaysAgo: 400 },
];

// Writing as you, for the creator the posts above are by: a guy who posts his outdoor photos on
// Bluesky, one line each, at most one emoji, at the end.
const PERSONA = {
  aboutYou:
    "I'm a guy who shoots outdoors and posts it on Bluesky: hills, forests, quiet coast and the roads between them. People follow for the light and the slow mornings, and the odd story from the trip.",
  tone: 'Short and calm, a little dry. One line, never salesy. At most one emoji, at the end.',
  contentTags: ['landscape', 'hiking', 'forest', 'golden hour', 'road trip', 'coast', 'film look'],
  rules: [
    'Never use hashtags',
    'No exclamation marks',
    'Never name the exact spot, only the region',
    'Keep each post well under 300 characters',
  ],
};

// His Bluesky profile (made up), where Follow-up with link sends people.
const PROFILE_LINK = 'https://bsky.app/profile/quietroads.bsky.social';

// The app's default prompt buttons (by placement and name) in his words, for Bluesky: Thread becomes a
// print teaser, Behind the scenes his photo of the week and Funnier Drier, under the same ids. And a
// trip recap.
const OVERRIDES: Record<string, Pick<NewPromptButton, 'name' | 'icon' | 'prompt'>> = {
  'post:Repost ideas': {
    name: 'Repost ideas',
    icon: 'repeat',
    prompt:
      "Write 3 fresh Bluesky posts that bring this back for people who missed it. Same trip, a new angle each time: the view, the moment, how it felt. Don't repeat the original wording.",
  },
  'post:Follow-up with link': {
    name: 'Follow-up with link',
    icon: 'link',
    prompt: `Write a short Bluesky reply to this post that points people to the rest of the trip on my profile. Say what else is there in one line. End with the link: ${PROFILE_LINK}`,
  },
  'post:Thread': {
    name: 'Print teaser',
    icon: 'printer',
    prompt:
      'Write a Bluesky post saying this photo is coming as a print. What makes it worth a wall, in one or two lines. No hard sell.',
  },
  'newPost:Caption': {
    name: 'Caption',
    icon: 'quote',
    prompt: 'Write 3 captions for these photos. Short, for Bluesky, one line each. Name the place only by its region.',
  },
  'newPost:Behind the scenes': {
    name: 'Photo of the week',
    icon: 'award',
    prompt:
      'Write a Bluesky thread of 3 short posts for my photo of the week: the shot, where and when, and one thing about how I took it.',
  },
  'refine:Shorter': {
    name: 'Shorter',
    icon: 'scissors',
    prompt: 'Make each post shorter. Keep the first line, cut the rest.',
  },
  'refine:Funnier': {
    name: 'Drier',
    icon: 'feather',
    prompt: 'Make each post drier and a little funnier. Same idea, one wry twist.',
  },
};
const PROMPT_BUTTONS: NewPromptButton[] = [
  ...DEFAULT_PROMPT_BUTTONS.map((button) => ({ ...button, ...OVERRIDES[`${button.placement}:${button.name}`] })),
  {
    id: mockUuid('prompt-button:trip-recap'),
    placement: 'newPost',
    name: 'Trip recap',
    icon: 'mountain',
    prompt:
      'Write 3 Bluesky posts that recap this trip from these photos: where it went, one thing that happened, one detail only I would notice.',
  },
];

// The posts it writes like, newest first: his own posts, and two options he hearted in the chat.
const FAVORITES: { text: string; source: string | null; daysAgo: number }[] = [
  { text: "Up before the sun again. The hills don't wait, and neither does the light.", source: null, daysAgo: 2 },
  { text: 'Golden hour on the ridge. Stayed until it was gone 🌅', source: 'Caption', daysAgo: 4 },
  { text: 'Three days, one tent, zero signal. Best weekend this year 🌲', source: null, daysAgo: 9 },
  {
    text: `The rest of the coast trip is on my profile. The last one is the photo I almost didn't post. ${PROFILE_LINK}`,
    source: 'Follow-up with link',
    daysAgo: 13,
  },
  { text: "Coffee on a cold rock tastes better. I don't make the rules.", source: null, daysAgo: 20 },
  { text: 'Some trails you hike for the view. This one was for the quiet.', source: null, daysAgo: 34 },
  { text: 'Packed for rain, got a sunburn. Classic.', source: null, daysAgo: 51 },
];

if (!email || !password) throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set (see .env.docker)');
if (!['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) {
  throw new Error(`Refusing to seed mock data into a non-local backend: ${API_URL}`);
}

const now = Date.now();
// Size and duration (ms) per clip, as bake-mock-videos.sh measured them.
const videoInfo = JSON.parse(await readFile(new URL('videos.json', MOCK_VIDEOS), 'utf8')) as Record<
  number,
  { width: number; height: number; duration: number }
>;
const { token, userId } = await login(email, password);

const assets: AssetRecord[] = [];
for (const [index, media] of MEDIA.entries()) {
  assets.push('video' in media ? await createVideoAsset(index, media) : await createPhotoAsset(index, media));
  console.log(`Uploaded media ${index + 1}/${MEDIA.length}`);
}
const assetAt = (index: number) => assets[index]!;
for (let index = assets.length; index < ASSET_COUNT; index++) assets.push(paddingAsset(index));

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
  const media = album.media ?? [];
  const positions = initialKeys(media.length);
  return media.map((item, i) => ({
    ...baseRecord(`album:${albumIndex}:asset:${item}`, now),
    albumId: albums[albumIndex]!.id,
    assetId: assetAt(item).id,
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
  const positions = initialKeys(post.media.length);
  return post.media.map((item, i) => ({
    ...baseRecord(`post:${postIndex}:asset:${item}`, now),
    postId: posts[postIndex]!.id,
    assetId: assetAt(item).id,
    position: positions[i]!,
  }));
});

// One persona per user, whose id is the user's id.
const personas: PersonaRecord[] = [{ ...baseRecord('persona', now - 60 * DAY), ...PERSONA, id: userId }];

// The instructions on the app's defaults (one record per user, like the persona), so a reset puts back
// a tester's edits rather than tombstoning their record.
const instructions: InstructionRecord[] = [
  { ...baseRecord('instructions', now), id: userId, writing: null, personaDraft: null, visionTagging: null },
];

// In each placement's order, positioned like the app's seed (seedPromptButtons).
const lastPosition = new Map<string, string | null>();
const promptButtons: PromptButtonRecord[] = PROMPT_BUTTONS.map((button) => {
  const position = keyBetween(lastPosition.get(button.placement) ?? null, null);
  lastPosition.set(button.placement, position);
  return { ...baseRecord(`prompt-button:${button.id}`, now - 60 * DAY), ...button, position };
});

const favorites: FavoriteRecord[] = FAVORITES.map((favorite, index) => ({
  ...baseRecord(`favorite:${index}`, now - favorite.daysAgo * DAY),
  text: favorite.text,
  source: favorite.source,
}));

const mockRecords: Record<string, { id: string }[]> = {
  assets,
  albums,
  album_assets: albumAssets,
  posts,
  post_assets: postAssets,
  personas,
  prompt_buttons: promptButtons,
  favorites,
  instructions,
};
const mutations = [...toMutations(mockRecords), ...(await tombstonesForOtherRecords(mockRecords))];
await push(mutations);

console.log(
  `Mock data ready: ${assets.length} assets, ${albums.length} albums, ${posts.length} posts, a persona,` +
    ` ${promptButtons.length} prompt buttons, ${favorites.length} favorites, default instructions (${mutations.length} records pushed).`,
);

async function createPhotoAsset(
  index: number,
  { picsum: picsumId, deleted }: { picsum: number; deleted?: boolean },
): Promise<AssetRecord> {
  const { width, height } = (await fetchJson(`https://picsum.photos/id/${picsumId}/info`)) as {
    width: number;
    height: number;
  };
  const full = fitWithin(width, height, FULL_SIZE);
  const thumbnail = fitWithin(width, height, THUMBNAIL_SIZE);
  const url = `https://picsum.photos/id/${picsumId}`;
  const [file, thumbnailFile] = await Promise.all([
    download(`${url}/${full.width}/${full.height}.jpg`),
    download(`${url}/${thumbnail.width}/${thumbnail.height}.jpg`),
  ]);
  return {
    ...(await uploadMedia(index, `asset:${picsumId}`, {
      extension: 'jpg',
      contentType: 'image/jpeg',
      file,
      thumbnailFile,
      deleted,
    })),
    mediaLibraryAssetId: `mock-${picsumId}`,
    mediaType: 'photo',
    width: full.width,
    height: full.height,
    duration: null,
  };
}

async function createVideoAsset(
  index: number,
  { video: clip, deleted }: { video: number; deleted?: boolean },
): Promise<AssetRecord> {
  const info = videoInfo[clip];
  if (!info) throw new Error(`Mock video ${clip} isn't baked: add it to scripts/bake-mock-videos.sh and run it`);
  const [file, thumbnailFile] = await Promise.all([
    readFile(new URL(`${clip}.mp4`, MOCK_VIDEOS)),
    readFile(new URL(`${clip}.jpg`, MOCK_VIDEOS)),
  ]);
  return {
    ...(await uploadMedia(index, `asset:video:${clip}`, {
      extension: 'mp4',
      contentType: 'video/mp4',
      file,
      thumbnailFile,
      deleted,
    })),
    mediaLibraryAssetId: `mock-video-${clip}`,
    mediaType: 'video',
    ...info,
  };
}

// Uploads a mock asset's file and thumbnail, and returns the fields photos and videos share.
async function uploadMedia(
  index: number,
  seed: string,
  {
    extension,
    contentType,
    file,
    thumbnailFile,
    deleted = false,
  }: { extension: string; contentType: string; file: Buffer; thumbnailFile: Buffer; deleted?: boolean },
) {
  const record = baseRecord(seed, now - index * 2.5 * DAY);
  const filename = `${record.id}.${extension}`;
  const thumbnailFilename = `${record.id}thumb.jpg`;
  await Promise.all([upload(filename, file, contentType), upload(thumbnailFilename, thumbnailFile, 'image/jpeg')]);
  return {
    ...record,
    deletedAt: deleted ? now : null,
    fileSize: file.length,
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

// A copy of one of the mock media under its own id, spread back in time behind them.
function paddingAsset(index: number): AssetRecord {
  const media = assetAt(index % MEDIA.length);
  return {
    ...media,
    ...baseRecord(`asset:padding:${index}`, now - index * 60 * 60 * 1000),
    mediaLibraryAssetId: `mock-padding-${index}`,
    isFavorite: index % 9 === 0,
    notes: null,
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
    records.map((record) => ({ collection, record: collectionsByName[collection]!.schema.parse(record) })),
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
      // Only the collections the mock data set makes: any other stays as it is.
      if (!(collection in keep)) continue;
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

async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const { accessToken, user } = (await request('/auth/login', { method: 'POST', body: { email, password } })) as {
    accessToken: string;
    user: { id: string };
  };
  return { token: accessToken, userId: user.id };
}

function api(path: string, body: unknown): Promise<unknown> {
  return request(path, { method: 'POST', body, token });
}

async function request(
  path: string,
  { method, body, token }: { method: string; body: unknown; token?: string },
): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upload(key: string, bytes: Buffer, contentType: string): Promise<void> {
  const res = await fetch(`${API_URL}/assets/upload/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Upload of ${key} failed: ${res.status} ${await res.text()}`);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download of ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchJson(url: string): Promise<unknown> {
  return JSON.parse((await download(url)).toString());
}
