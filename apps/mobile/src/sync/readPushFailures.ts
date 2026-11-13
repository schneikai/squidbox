import type { CollectionName } from '@squidbox/shared';
import { asc, count } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { describeAsset } from './describeAsset';
import { failedOutboxRows } from './outbox';
import { readByIdMap } from './readByIds';

/** A failure the sync error viewer lists: what failed (`title`), why (`error`), and where the way out is (`href`). */
export type SyncFailureRow = { id: string | number; title: string; error: string | null; href?: string };

/**
 * A pending change the server rejected: `id` is its outbox row's, `title` names what failed in words
 * (`Album "Trips"`, `Photo in post "Sunset…"`), `href` is its record's screen, where the way out is
 * (a contact whose photo needs choosing again).
 */
export type PushFailure = SyncFailureRow & { id: number; error: string };

const SNIPPET_LENGTH = 40;

// The screen of a record in a collection that has one, for a failure of an edit (a deletion has none).
const HREFS: Record<string, (id: string) => string> = {
  albums: (id) => `/album/${id}`,
  posts: (id) => `/post/${id}`,
  contacts: (id) => `/contact/${id}`,
  contact_lists: (id) => `/contact-list/${id}`,
};

/**
 * The pending changes the server rejected (sync-design §6), oldest first, each named after its record
 * as the payload has it (an edge after its album or post), with their count: a paged read.
 */
export async function readPushFailures(
  db: SyncDb,
  { limit }: { limit: number },
): Promise<{ rows: PushFailure[]; count: number }> {
  return db.transaction(async (tx) => {
    const [total] = await tx.select({ count: count() }).from(schema.outbox).where(failedOutboxRows);
    const rows = await tx
      .select()
      .from(schema.outbox)
      .where(failedOutboxRows)
      .orderBy(asc(schema.outbox.id))
      .limit(limit);
    const albums = await readByIdMap(tx, schema.albums, parentIds(rows, 'album_assets', 'albumId'));
    const posts = await readByIdMap(tx, schema.posts, parentIds(rows, 'post_assets', 'postId'));
    const lists = await readByIdMap(tx, schema.contactLists, parentIds(rows, 'contact_list_members', 'listId'));
    return {
      rows: rows.map((row) => ({
        id: row.id,
        title: describe(row, { albums, posts, lists }),
        error: row.error ?? '',
        ...(row.op === 'upsert' && HREFS[row.collection] && { href: HREFS[row.collection]!(row.recordId) }),
      })),
      count: total?.count ?? 0,
    };
  });
}

function parentIds(rows: schema.OutboxRow[], collection: string, key: string): string[] {
  return rows.filter((row) => row.collection === collection).map((row) => String(row.payload[key]));
}

const LINK_TARGETS: Record<string, string> = { asset: 'a photo', album: 'an album', post: 'a post' };

type Parents = {
  albums: Map<string, schema.AlbumRow>;
  posts: Map<string, schema.PostRow>;
  lists: Map<string, schema.ContactListRow>;
};

// What failed, in words, per collection: keyed by the registry's names, so a new collection fails
// typecheck until it has one.
const TITLES: Record<CollectionName, (payload: Record<string, unknown>, parents: Parents) => string> = {
  albums: (payload) => `Album "${payload.name}"`,
  posts: (payload) => `Post${snippet(String(payload.text ?? ''))}`,
  assets: (payload) => describeAsset(payload),
  album_assets: (payload, { albums }) => {
    const album = albums.get(String(payload.albumId));
    return album ? `Photo in album "${album.name}"` : 'Photo in an album';
  },
  post_assets: (payload, { posts }) => {
    const post = posts.get(String(payload.postId));
    return post ? `Photo in post${snippet(post.text)}` : 'Photo in a post';
  },
  personas: () => 'Writing as you',
  prompt_buttons: (payload) => `Prompt button "${payload.name}"`,
  favorites: (payload) => `Favorite${snippet(String(payload.text ?? ''))}`,
  instructions: () => 'Instructions',
  model_choices: () => 'Default models',
  contacts: (payload) => `Contact "${payload.name}"`,
  contact_lists: (payload) => `List "${payload.name}"`,
  contact_list_members: (payload, { lists }) => {
    const list = lists.get(String(payload.listId));
    return list ? `Contact in list "${list.name}"` : 'Contact in a list';
  },
  contact_links: (payload) => `Contact on ${LINK_TARGETS[String(payload.targetType)] ?? 'a photo'}`,
  contact_settings: () => 'Pinned list on Contacts',
  idea_settings: () => 'Post ideas and Repost ideas',
};

function describe({ collection, recordId, payload }: schema.OutboxRow, parents: Parents): string {
  return Object.hasOwn(TITLES, collection)
    ? TITLES[collection as CollectionName](payload, parents)
    : `${collection} ${recordId}`;
}

// ` "First words of the caption…"`, or nothing for an empty caption. Cut by code point, so an emoji
// is never split in half.
function snippet(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  const chars = Array.from(line);
  if (chars.length === 0) return '';
  return ` "${chars.length > SNIPPET_LENGTH ? `${chars.slice(0, SNIPPET_LENGTH).join('').trimEnd()}…` : line}"`;
}
