/**
 * Fills the LOCAL backend with a fixed set of mock data for the dev client: stock photos from
 * unsplash.com and stock videos with music from mixkit.co (all free to use, baked into
 * scripts/mock-photos and scripts/mock-videos by bake-mock-photos.sh and bake-mock-videos.sh, so
 * seeding needs no network), albums (including the smart Favorites/Deleted albums)
 * and posts, all by one guy who posts his outdoor photos on Bluesky, the people he shoots and
 * sells prints with (contacts with their photos, in two lists, on a photo, an album and a post), and
 * his assistant setup: Writing
 * as you, the prompt buttons (the app's defaults in his words, and one more), his Post ideas and
 * Repost ideas prompts and the Instructions, left on the app's defaults. Re-running resets the account to exactly this set: ids
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
  promptButtonCollection,
  type AlbumAssetRecord,
  type AlbumRecord,
  type AssetRecord,
  type ContactLinkRecord,
  type ContactListMemberRecord,
  type ContactListRecord,
  type ContactRecord,
  type IdeaSettingRecord,
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
import { MOCK_PERSONA, PROFILE_LINK } from '../src/ai/mockPersona.js';

const API_URL = process.env.MOCK_API_URL ?? `http://localhost:${process.env.PORT ?? 3100}/api/v1`;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

const DAY = 24 * 60 * 60 * 1000;
const MOCK_PHOTOS = new URL('./mock-photos/', import.meta.url);
const MOCK_VIDEOS = new URL('./mock-videos/', import.meta.url);
// Unsplash photo ids and Mixkit clip ids, each baked into scripts/mock-photos or scripts/mock-videos.
type MockMedia = ({ photo: string } | { video: number }) & { deleted?: boolean };

// Newest first, landscape and portrait photos mixed with videos. Albums and posts refer to media by
// their index in this list; `deleted` ones are in the Deleted album.
const MEDIA: MockMedia[] = [
  { photo: '1445363692815-ebcd599f7621' },
  { photo: '1472214103451-9374bd1c798e' },
  { photo: '1500964757637-c85e8a162699' },
  { photo: '1433086966358-54859d0ed716' },
  { video: 808 },
  { photo: '1507525428034-b723cf961d3e' },
  { photo: '1499678329028-101435549a4e' },
  { photo: '1414609245224-afa02bfb3fda' },
  { photo: '1501785888041-af3ef285b470' },
  { photo: '1464822759023-fed622ff2c3b' },
  { photo: '1504280390367-361c6d9f38f4' },
  { video: 1183 },
  { photo: '1478131143081-80f7f84ca84d' },
  { photo: '1454496522488-7a8e488e8606' },
  { photo: '1551632811-561732d1e306' },
  { photo: '1441974231531-c6227db76b6e' },
  { photo: '1447752875215-b2761acb3c5d' },
  { photo: '1418065460487-3e41a6c84dc5' },
  { video: 4646 },
  { photo: '1520962922320-2038eebab146' },
  { photo: '1446329813274-7c9036bd9a1f' },
  { photo: '1519904981063-b0cf448d479e' },
  { photo: '1493246507139-91e8fad9978e' },
  { photo: '1468276311594-df7cb65d8df6' },
  { photo: '1426604966848-d7adac402bff' },
  { video: 1197 },
  { photo: '1476514525535-07fb3b4ae5f1' },
  { photo: '1519681393784-d120267933ba' },
  { photo: '1500530855697-b586d89ba3ee' },
  { photo: '1508193638397-1c4234db14d8' },
  { photo: '1470071459604-3b5ec3a7fe05' },
  { photo: '1501555088652-021faa106b9b' },
  { video: 529 },
  { photo: '1506905925346-21bda4d32df4' },
  { photo: '1510414842594-a61c69b5ae57' },
  { photo: '1500534314209-a25ddb2bd429' },
  { photo: '1513836279014-a89f7a76ae86' },
  { photo: '1518173946687-a4c8892bbd9f' },
  { photo: '1503614472-8c93d56e92ce' },
  { video: 1214 },
  { photo: '1522163182402-834f871fd851' },
  { photo: '1487730116645-74489c95b41b' },
  { photo: '1523712999610-f77fbcfc3843' },
  { photo: '1470770841072-f978cf4d019e' },
  { photo: '1511497584788-876760111969' },
  { photo: '1543039625-14cbd3802e7d' },
  { video: 4132 },
  { photo: '1527489377706-5bf97e608852' },
  { photo: '1482192596544-9eb780fc7f66', deleted: true },
  { photo: '1494500764479-0c8f2919a3d8', deleted: true },
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

// `thread`: the posts that follow this one in its thread, each with its own text and photos.
const POSTS: {
  text: string;
  media: number[];
  postedDaysAgo: number | null;
  isFavorite?: boolean;
  thread?: { text: string; media: number[] }[];
}[] = [
  { text: 'First light over the hills ☀️', media: [0, 1], postedDaysAgo: 40, isFavorite: true },
  { text: 'Lost in the forest for a day with @ridgeline.bsky.social 🌲', media: [14, 15, 17, 32], postedDaysAgo: 32 },
  { text: 'Coffee and a view. That is all.', media: [4, 33], postedDaysAgo: 21 },
  {
    text: 'Summer recap, part 1, with @ridgeline.bsky.social',
    media: [3, 5, 7, 8, 11],
    postedDaysAgo: 12,
    thread: [
      { text: 'Day two: the coast road, one stop at every pull-out 🌊', media: [6, 25] },
      { text: 'Last walk before heading home. Part 2 soon.', media: [16] },
      { text: 'Thanks for following along. Back on the trail next weekend 🥾', media: [] },
    ],
  },
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

// The people he hikes, shoots and sells prints with. `avatar`: an Unsplash photo id baked into
// scripts/mock-photos, uploaded as the contact's photo; `on`: the photo (media index), album (ALBUMS index) or post (POSTS index) they are on.
const CONTACTS: {
  name: string;
  fields: Partial<ContactRecord>;
  isFavorite?: boolean;
  avatar?: string;
  on?: { asset?: number; album?: number; post?: number };
}[] = [
  {
    name: 'Sam Ridge',
    avatar: '1506794778202-cad84cf45f1d',
    fields: {
      blueskyHandle: 'ridgeline.bsky.social',
      places: [{ city: 'Squamish', state: 'British Columbia', country: 'Canada' }],
      notes: 'Hiking buddy. Shoots on film, knows every trailhead.',
    },
    isFavorite: true,
    on: { asset: 14, post: 1 },
  },
  {
    name: 'Maya Lindqvist',
    avatar: '1438761681033-6461ffad8d80',
    fields: {
      xHandle: 'mayalindqvist',
      blueskyHandle: 'mayalindqvist.bsky.social',
      places: [
        { city: 'Tromsø', state: '', country: 'Norway' },
        { city: '', state: 'Nordland', country: 'Norway' },
      ],
      notes: 'Landscape photographer. Met at the print fair; swap prints every spring.',
    },
    isFavorite: true,
    on: { album: 2 },
  },
  {
    name: 'Theo Park',
    avatar: '1527980965255-d3b416303d12',
    fields: {
      xHandle: 'theoparkphoto',
      phoneNumber: '+1 303 555 0187',
      places: [
        { city: 'Denver', state: 'Colorado', country: 'United States' },
        { city: 'Moab', state: 'Utah', country: 'United States' },
      ],
    },
    on: { asset: 14 },
  },
  {
    name: 'Lena Ortiz',
    avatar: '1494790108377-be9c29b29330',
    fields: { blueskyHandle: 'lenaortiz.bsky.social', places: [{ city: 'Lisbon', state: '', country: 'Portugal' }] },
  },
  {
    name: 'Jonas Weber',
    avatar: '1560250097-0b93528c311a',
    fields: {
      blueskyHandle: 'jonasweber.bsky.social',
      places: [{ city: 'Innsbruck', state: 'Tyrol', country: 'Austria' }],
      notes: 'Runs the gallery that sells my prints.',
    },
  },
];

// The lists, with the CONTACTS (by index) in them.
const CONTACT_LISTS: { name: string; notes: string; members: number[] }[] = [
  { name: 'Hiking crew', notes: 'Who to ask along for a weekend trip.', members: [0, 2, 4] },
  { name: 'Print buyers', notes: 'Send them the new prints first.', members: [1, 3, 4] },
];

// His Post ideas and Repost ideas prompts, for Bluesky.
const IDEA_PROMPTS = {
  postIdeasPrompt:
    'Write 6 captions for these photos. Short, for Bluesky, one line each. Name the place only by its region.',
  repostIdeasPrompt:
    "Write 6 fresh Bluesky posts that bring this back for people who missed it. Same trip, a new angle each time: the view, the moment, how it felt. Don't repeat the original wording.",
};

// The app's default prompt buttons (by name) in his words, for Bluesky: Thread becomes a print teaser,
// Behind the scenes his photo of the week and Funnier Drier, under the same ids. And a trip recap.
const OVERRIDES: Record<string, Pick<NewPromptButton, 'name' | 'icon' | 'prompt'>> = {
  'Follow-up with link': {
    name: 'Follow-up with link',
    icon: 'link',
    prompt: `Write a short Bluesky reply to this post that points people to the rest of the trip on my profile. Say what else is there in one line. End with the link: ${PROFILE_LINK}`,
  },
  Thread: {
    name: 'Print teaser',
    icon: 'printer',
    prompt:
      'Write a Bluesky post saying this photo is coming as a print. What makes it worth a wall, in one or two lines. No hard sell.',
  },
  'Behind the scenes': {
    name: 'Photo of the week',
    icon: 'award',
    prompt:
      'Write a Bluesky thread of 3 short posts for my photo of the week: the shot, where and when, and one thing about how I took it.',
  },
  Shorter: {
    name: 'Shorter',
    icon: 'scissors',
    prompt:
      'Make it shorter: the newest posts in this chat, or my caption when there are none yet. Keep the first line, cut the rest.',
  },
  Funnier: {
    name: 'Drier',
    icon: 'feather',
    prompt:
      'Make it drier and a little funnier: the newest posts in this chat, or my caption when there are none yet. Same idea, one wry twist.',
  },
};
const PROMPT_BUTTONS: NewPromptButton[] = [
  ...DEFAULT_PROMPT_BUTTONS.map((button) => ({ ...button, ...OVERRIDES[button.name] })),
  {
    id: mockUuid('prompt-button:trip-recap'),
    name: 'Trip recap',
    icon: 'mountain',
    prompt:
      'Write 3 Bluesky posts that recap this trip from these photos: where it went, one thing that happened, one detail only I would notice.',
  },
];

if (!email || !password) throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set (see .env.docker)');
if (!['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) {
  throw new Error(`Refusing to seed mock data into a non-local backend: ${API_URL}`);
}

const now = Date.now();
// Full size per photo, as bake-mock-photos.sh fitted it.
const photoInfo = JSON.parse(await readFile(new URL('photos.json', MOCK_PHOTOS), 'utf8')) as Record<
  string,
  { width: number; height: number }
>;
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
  favoritedAt: index === 2 ? now : null,
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

// A post record: `key` names it (its id and its edges'), `fields` what sets it apart.
const postRecord = (key: string, createdAt: number, fields: Partial<PostRecord>): PostRecord => ({
  ...baseRecord(key, createdAt),
  text: '',
  isFavorite: false,
  postedAt: null,
  rePostId: null,
  isIgnoredForRepost: false,
  suggestRepostAt: 0,
  hasBeenReposted: false,
  ...fields,
});

const posts: PostRecord[] = POSTS.map((post, index) => {
  const postedAt = post.postedDaysAgo === null ? null : now - post.postedDaysAgo * DAY;
  return postRecord(`post:${index}`, postedAt ?? now - index * DAY, {
    text: post.text,
    isFavorite: post.isFavorite ?? false,
    postedAt,
    suggestRepostAt: postedAt === null ? 0 : postedAt + 90 * DAY,
  });
});

// A thread's following posts: their own records, linked to the first post, with its Posted time.
const threadParts = POSTS.flatMap((post, index) =>
  (post.thread ?? []).map((part, j) => ({ ...part, key: `post:${index}:part:${j + 1}`, root: posts[index]!, j })),
);
for (const { text, key, root, j } of threadParts) {
  posts.push(
    postRecord(key, root.createdAt, {
      text,
      postedAt: root.postedAt,
      suggestRepostAt: root.suggestRepostAt,
      threadRootId: root.id,
      threadIndex: j + 1,
    }),
  );
}

// Each post's edges to its `media`, in that order.
const postAssets: PostAssetRecord[] = [
  ...POSTS.map((post, index) => ({ key: `post:${index}`, media: post.media })),
  ...threadParts,
].flatMap(({ key, media }) => {
  const positions = initialKeys(media.length);
  return media.map((item, i) => ({
    ...baseRecord(`${key}:asset:${item}`, now),
    postId: mockUuid(key),
    assetId: assetAt(item).id,
    position: positions[i]!,
  }));
});

// One persona per user, whose id is the user's id.
const personas: PersonaRecord[] = [{ ...baseRecord('persona', now - 60 * DAY), ...MOCK_PERSONA, id: userId }];

// The instructions on the app's defaults (one record per user, like the persona), so a reset puts back
// a tester's edits rather than tombstoning their record.
const instructions: InstructionRecord[] = [
  {
    ...baseRecord('instructions', now),
    id: userId,
    writing: null,
    visionTagging: null,
    moreLikeThis: null,
    modelCheckJudge: null,
  },
];

// His ideas on, in his words (one record per user, like the persona).
const ideaSettings: IdeaSettingRecord[] = [
  { ...baseRecord('idea-settings', now), id: userId, postIdeasOn: true, repostIdeasOn: true, ...IDEA_PROMPTS },
];

const contacts: ContactRecord[] = [];
for (const [index, contact] of CONTACTS.entries()) {
  const record = baseRecord(`contact:${index}`, now - (index + 3) * 7 * DAY);
  let avatarFilename: string | null = null;
  if (contact.avatar !== undefined) {
    avatarFilename = `avatar-${record.id}-1.jpg`;
    await upload(avatarFilename, await readMockPhoto(`${contact.avatar}-avatar.jpg`), 'image/jpeg');
  }
  contacts.push({
    ...record,
    name: contact.name,
    isFavorite: contact.isFavorite ?? false,
    favoritedAt: contact.isFavorite ? record.createdAt : null,
    notes: null,
    xHandle: null,
    blueskyHandle: null,
    onlyFansHandle: null,
    jffHandle: null,
    instagramHandle: null,
    phoneNumber: null,
    places: [],
    ...contact.fields,
    avatarFilename,
  });
}
const contactLists: ContactListRecord[] = CONTACT_LISTS.map((list, index) => ({
  ...baseRecord(`contact-list:${index}`, now - 14 * DAY),
  name: list.name,
  notes: list.notes,
}));
const contactListMembers: ContactListMemberRecord[] = CONTACT_LISTS.flatMap((list, index) =>
  list.members.map((member) => ({
    ...baseRecord(`contact-list:${index}:contact:${member}`, now),
    listId: contactLists[index]!.id,
    contactId: contacts[member]!.id,
  })),
);
const contactLinks: ContactLinkRecord[] = CONTACTS.flatMap(({ on = {} }, index) =>
  [
    on.asset === undefined ? null : { targetType: 'asset' as const, targetId: assetAt(on.asset).id },
    on.album === undefined ? null : { targetType: 'album' as const, targetId: albums[on.album]!.id },
    on.post === undefined ? null : { targetType: 'post' as const, targetId: posts[on.post]!.id },
  ].flatMap((link) =>
    link
      ? [
          {
            ...baseRecord(`contact:${index}:${link.targetType}:${link.targetId}`, now),
            contactId: contacts[index]!.id,
            ...link,
          },
        ]
      : [],
  ),
);

// In order, positioned like the app's seed (seedPromptButtons).
let lastPosition: string | null = null;
// Parsed, so each takes the schema's default placement.
const promptButtons: PromptButtonRecord[] = PROMPT_BUTTONS.map((button) => {
  lastPosition = keyBetween(lastPosition, null);
  return promptButtonCollection.schema.parse({
    ...baseRecord(`prompt-button:${button.id}`, now - 60 * DAY),
    ...button,
    position: lastPosition,
  });
});

const mockRecords: Record<string, { id: string }[]> = {
  assets,
  albums,
  album_assets: albumAssets,
  posts,
  post_assets: postAssets,
  personas,
  prompt_buttons: promptButtons,
  instructions,
  idea_settings: ideaSettings,
  contacts,
  contact_lists: contactLists,
  contact_list_members: contactListMembers,
  contact_links: contactLinks,
};
const mutations = [...toMutations(mockRecords), ...(await tombstonesForOtherRecords(mockRecords))];
await push(mutations);

console.log(
  `Mock data ready: ${assets.length} assets, ${albums.length} albums, ${posts.length} posts, a persona,` +
    ` ${promptButtons.length} prompt buttons, default instructions, his ideas prompts, ${contacts.length} contacts in` +
    ` ${contactLists.length} lists (${mutations.length} records pushed).`,
);

async function createPhotoAsset(
  index: number,
  { photo: id, deleted }: { photo: string; deleted?: boolean },
): Promise<AssetRecord> {
  const info = photoInfo[id];
  if (!info) throw new Error(`Mock photo ${id} isn't baked: add it to scripts/bake-mock-photos.sh and run it`);
  const [file, thumbnailFile] = await Promise.all([readMockPhoto(`${id}.jpg`), readMockPhoto(`${id}-thumb.jpg`)]);
  return {
    ...(await uploadMedia(index, `asset:${id}`, {
      extension: 'jpg',
      contentType: 'image/jpeg',
      file,
      thumbnailFile,
      deleted,
    })),
    mediaLibraryAssetId: `mock-${id}`,
    mediaType: 'photo',
    ...info,
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

function readMockPhoto(name: string): Promise<Buffer> {
  return readFile(new URL(name, MOCK_PHOTOS));
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
