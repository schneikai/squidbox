import { ASSET_TAG_LIMITS, uniqueTags } from '@squidbox/shared';

import type { AssetRow } from '@/sync/db/schema';
import tagKey from '@/utils/tagKey';
import tagsDifference, { type TagsEdit } from '@/utils/tagsDifference';

/** A photo of the album as the sheet starts: its id and its tags (null while never tagged). */
export type AlbumTagsPhoto = Pick<AssetRow, 'id' | 'tags'>;

// A chip: the tag as first spelled, its key (tagKey), and whether it is on all the photos.
type AlbumTag = { tag: string; key: string; onAll: boolean };

/**
 * An album's Tags sheet's draft: every tag on any of its photos, each on all of them or only some
 * (mixed). `seed` is the chips as the sheet opened, `photoKeys` each photo's tag keys then, for the
 * room each one has left.
 */
export type AlbumTagsDraft = {
  readonly tags: readonly AlbumTag[];
  readonly seed: readonly AlbumTag[];
  readonly photoKeys: readonly ReadonlySet<string>[];
};

/**
 * The album Tags sheet's draft and what can be done to it, each a pure function returning a new
 * draft: `start(photos)` builds it; `change(draft, list)` takes TagsField's new list (a tag taken
 * out comes off all photos, a new one goes on all at the end while it fits); `putOnAll(draft, tag)`
 * puts a mixed tag on all where it is (null when a photo lacking it has no room); `addOnAll(draft,
 * tags)` puts Tag it's tags on all, in order while they fit. Readers: `tags` (the chips), `mixedTags`
 * (the dashed ones), `room` (the fewest free slots any photo has), `edit` (what Save writes) and
 * `isDirty`.
 */
const albumTagsDraft = {
  start,
  change,
  putOnAll,
  addOnAll,
  tags: draftTags,
  mixedTags,
  room,
  edit,
  isDirty,
};

export default albumTagsDraft;

// The chips in order: the tags on the most photos first, then in the order they first appear (the
// photos in the album's order, each one's tags in theirs). A photo with `tags === null` has none.
// Tags are grouped by tagKey; a chip shows the first spelling.
function start(photos: readonly AlbumTagsPhoto[]): AlbumTagsDraft {
  const byKey = new Map<string, { tag: string; count: number }>();
  const photoKeys = photos.map((photo) => {
    const keys = new Set<string>();
    for (const tag of uniqueTags(photo.tags ?? [])) {
      const key = tagKey(tag);
      keys.add(key);
      const entry = byKey.get(key);
      byKey.set(key, { tag: entry?.tag ?? tag, count: (entry?.count ?? 0) + 1 });
    }
    return keys;
  });
  // Array.prototype.sort is stable, so equal counts keep their first appearance.
  const tags = [...byKey]
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([key, { tag, count }]) => ({ tag, key, onAll: count === photos.length }));
  return { tags, seed: tags, photoKeys };
}

function draftTags(draft: AlbumTagsDraft): string[] {
  return draft.tags.map((entry) => entry.tag);
}

function mixedTags(draft: AlbumTagsDraft): string[] {
  return draft.tags.filter((entry) => !entry.onAll).map((entry) => entry.tag);
}

// Each photo's tag count after the draft's edit (every tag on all, and its own mixed ones), once per
// draft: the sheet asks on every render.
const sizesByDraft = new WeakMap<AlbumTagsDraft, number[]>();
function photoSizes(draft: AlbumTagsDraft): number[] {
  const cached = sizesByDraft.get(draft);
  if (cached) return cached;
  const onAll = draft.tags.filter((entry) => entry.onAll).length;
  const mixed = draft.tags.filter((entry) => !entry.onAll).map((entry) => entry.key);
  const sizes = draft.photoKeys.map((keys) => onAll + mixed.filter((key) => keys.has(key)).length);
  // An album without photos still holds the tags on all to the limit.
  if (sizes.length === 0) sizes.push(onAll);
  sizesByDraft.set(draft, sizes);
  return sizes;
}

// The fewest tags any photo has room for after the draft's edit (ASSET_TAG_LIMITS.tags each): a tag
// put on all photos needs a slot on every one.
function room(draft: AlbumTagsDraft): number {
  return Math.max(ASSET_TAG_LIMITS.tags - Math.max(...photoSizes(draft)), 0);
}

// The tags newly on all and those taken off, against the tags the sheet opened with.
function edit(draft: AlbumTagsDraft): TagsEdit {
  const seedOnAll = new Set(draft.seed.filter((entry) => entry.onAll).map((entry) => entry.key));
  return {
    add: draft.tags.filter((entry) => entry.onAll && !seedOnAll.has(entry.key)).map((entry) => entry.tag),
    remove: tagsDifference(
      draft.seed.map((entry) => entry.tag),
      draftTags(draft),
    ).remove,
  };
}

function isDirty(draft: AlbumTagsDraft): boolean {
  const { add, remove } = edit(draft);
  return add.length > 0 || remove.length > 0;
}

// Typing a mixed tag again is TagsField's `mixed.onPress` (putOnAll), so only new keys arrive here.
function change(draft: AlbumTagsDraft, next: readonly string[]): AlbumTagsDraft {
  const { add, remove } = tagsDifference(draftTags(draft), next);
  const removed = new Set(remove.map(tagKey));
  const kept: AlbumTagsDraft = { ...draft, tags: draft.tags.filter((entry) => !removed.has(entry.key)) };
  return add.reduce((changed, tag) => putOrAdd(changed, tag) ?? changed, kept);
}

function putOnAll(draft: AlbumTagsDraft, tag: string): AlbumTagsDraft | null {
  const key = tagKey(tag);
  const entry = draft.tags.find((each) => each.key === key);
  if (!entry || entry.onAll) return draft;
  const sizes = photoSizes(draft);
  const fits = draft.photoKeys.every((keys, i) => keys.has(key) || sizes[i]! < ASSET_TAG_LIMITS.tags);
  if (!fits) return null;
  return { ...draft, tags: draft.tags.map((each) => (each.key === key ? { ...each, onAll: true } : each)) };
}

function addOnAll(draft: AlbumTagsDraft, tags: readonly string[]): AlbumTagsDraft {
  return uniqueTags(tags).reduce((changed, tag) => putOrAdd(changed, tag) ?? changed, draft);
}

// The tag on all photos: put on all where it is, or added at the end when it isn't there; null when
// it doesn't fit.
function putOrAdd(draft: AlbumTagsDraft, tag: string): AlbumTagsDraft | null {
  const key = tagKey(tag);
  if (!key) return draft;
  if (draft.tags.some((entry) => entry.key === key)) return putOnAll(draft, tag);
  if (room(draft) === 0) return null;
  return { ...draft, tags: [...draft.tags, { tag: tag.trim(), key, onAll: true }] };
}
