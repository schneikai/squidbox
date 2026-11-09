import { ASSET_TAG_LIMITS, uniqueTags } from '@squidbox/shared';

import type { AssetRow } from '@/sync/db/schema';
import tagKey from '@/utils/tagKey';
import type { TagsEdit } from '@/utils/tagsDifference';

/** A photo of the album as the sheet starts: its id and its tags (null while never tagged). */
export type AlbumTagsPhoto = Pick<AssetRow, 'id' | 'tags'>;

// A chip: the tag as first spelled, its key (tagKey), how many photos had it when the sheet opened,
// and whether it is on all of them now.
type AlbumTag = { tag: string; key: string; count: number; onAll: boolean };

/**
 * An album's Tags sheet's draft: every tag on any of its photos, each on all of them or only some.
 * `photoKeys` are each photo's tag keys as the sheet opened, for the room each one has left.
 */
export type AlbumTagsDraft = {
  readonly tags: readonly AlbumTag[];
  readonly seed: readonly AlbumTag[];
  readonly photoKeys: readonly ReadonlySet<string>[];
};

/**
 * The draft of these photos' tags, in the sheet's chip order: the tags on the most photos first, then
 * in the order they first appear (the photos in the album's order, each one's tags in theirs). A
 * photo with `tags === null` has none. Tags are grouped by tagKey; a chip shows the first spelling.
 */
export function startAlbumTags(photos: readonly AlbumTagsPhoto[]): AlbumTagsDraft {
  const byKey = new Map<string, AlbumTag>();
  const photoKeys = photos.map((photo) => {
    const keys = new Set<string>();
    for (const tag of uniqueTags(photo.tags ?? [])) {
      const key = tagKey(tag);
      keys.add(key);
      const entry = byKey.get(key) ?? { tag, key, count: 0, onAll: false };
      byKey.set(key, { ...entry, count: entry.count + 1 });
    }
    return keys;
  });
  // Array.prototype.sort is stable, so equal counts keep their first appearance.
  const tags = [...byKey.values()]
    .map((entry) => ({ ...entry, onAll: entry.count === photos.length }))
    .sort((a, b) => b.count - a.count);
  return { tags, seed: tags, photoKeys };
}

/** The chips' tags, in order. */
export function draftTags(draft: AlbumTagsDraft): string[] {
  return draft.tags.map((entry) => entry.tag);
}

/** The tags on only some of the photos (dashed chips). */
export function partialTags(draft: AlbumTagsDraft): string[] {
  return draft.tags.filter((entry) => !entry.onAll).map((entry) => entry.tag);
}

/**
 * The fewest tags any photo has room for after the draft's edit (ASSET_TAG_LIMITS.tags each): a tag
 * put on all photos needs a slot on every one.
 */
export function room(draft: AlbumTagsDraft): number {
  const sizes = draft.photoKeys.map((keys) => afterEdit(draft, keys).size);
  const onAll = draft.tags.filter((entry) => entry.onAll).length;
  return Math.max(ASSET_TAG_LIMITS.tags - Math.max(onAll, ...sizes), 0);
}

/** What Save writes, against the tags the sheet opened with: the tags newly on all and those taken off. */
export function draftEdit(draft: AlbumTagsDraft): TagsEdit {
  const keys = new Set(draft.tags.map((entry) => entry.key));
  const seedOnAll = new Set(draft.seed.filter((entry) => entry.onAll).map((entry) => entry.key));
  return {
    add: draft.tags.filter((entry) => entry.onAll && !seedOnAll.has(entry.key)).map((entry) => entry.tag),
    remove: draft.seed.filter((entry) => !keys.has(entry.key)).map((entry) => entry.tag),
  };
}

/** Whether the draft would change any photo's tags. */
export function isDirty(draft: AlbumTagsDraft): boolean {
  const { add, remove } = draftEdit(draft);
  return add.length > 0 || remove.length > 0;
}

/**
 * The draft after TagsField's change to the chips' list: a tag taken out comes off all photos, and a
 * new one goes on all of them at the end, while it fits. (Typing a tag that is on some is
 * TagsField's `partial.onPress`: putOnAll.)
 */
export function changeTags(draft: AlbumTagsDraft, next: readonly string[]): AlbumTagsDraft {
  const nextKeys = new Set(next.map(tagKey));
  const kept: AlbumTagsDraft = { ...draft, tags: draft.tags.filter((entry) => nextKeys.has(entry.key)) };
  const keptKeys = new Set(kept.tags.map((entry) => entry.key));
  return next
    .filter((tag) => !keptKeys.has(tagKey(tag)))
    .reduce((changed, tag) => putOrAdd(changed, tag) ?? changed, kept);
}

/**
 * The draft with a tag on only some photos put on all of them, where it is; null when a photo that
 * lacks it has no room for another tag.
 */
export function putOnAll(draft: AlbumTagsDraft, tag: string): AlbumTagsDraft | null {
  const key = tagKey(tag);
  const entry = draft.tags.find((each) => each.key === key);
  if (!entry || entry.onAll) return draft;
  const fits = draft.photoKeys.every((keys) => {
    const tags = afterEdit(draft, keys);
    return tags.has(key) || tags.size < ASSET_TAG_LIMITS.tags;
  });
  if (!fits) return null;
  return { ...draft, tags: draft.tags.map((each) => (each.key === key ? { ...each, onAll: true } : each)) };
}

/**
 * Tag it's tags on all photos, in order while they fit (the rest are dropped): a tag on all stays, one
 * on some goes on all, a new one is added at the end.
 */
export function addOnAll(draft: AlbumTagsDraft, tags: readonly string[]): AlbumTagsDraft {
  return uniqueTags(tags).reduce((changed, tag) => putOrAdd(changed, tag) ?? changed, draft);
}

// The tag on all photos: put on all where it is, or added at the end when it isn't there; null when
// it doesn't fit.
function putOrAdd(draft: AlbumTagsDraft, tag: string): AlbumTagsDraft | null {
  const key = tagKey(tag);
  if (!key) return draft;
  if (draft.tags.some((entry) => entry.key === key)) return putOnAll(draft, tag);
  if (room(draft) === 0) return null;
  const count = draft.seed.find((entry) => entry.key === key)?.count ?? 0;
  return { ...draft, tags: [...draft.tags, { tag: tag.trim(), key, count, onAll: true }] };
}

// A photo's tag keys after the draft's edit: those still in the draft, and every tag on all.
function afterEdit(draft: AlbumTagsDraft, keys: ReadonlySet<string>): Set<string> {
  return new Set(draft.tags.filter((entry) => entry.onAll || keys.has(entry.key)).map((entry) => entry.key));
}
