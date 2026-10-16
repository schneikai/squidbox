import { asc, count } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { describeAsset } from './describeAsset';
import { failedOutboxRows } from './outbox';
import { readByIdMap } from './readByIds';

export interface PushFailure {
  id: number; // the outbox row's
  title: string; // what failed, in words: `Album "Trips"`, `Photo in post "Sunset…"`
  error: string;
}

const SNIPPET_LENGTH = 40;

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
    const albums = await readByIdMap<schema.AlbumRow>(tx, schema.albums, parentIds(rows, 'album_assets', 'albumId'));
    const posts = await readByIdMap<schema.PostRow>(tx, schema.posts, parentIds(rows, 'post_assets', 'postId'));
    return {
      rows: rows.map((row) => ({ id: row.id, title: describe(row, albums, posts), error: row.error ?? '' })),
      count: total?.count ?? 0,
    };
  });
}

function parentIds(rows: schema.OutboxRow[], collection: string, key: string): string[] {
  return rows.filter((row) => row.collection === collection).map((row) => String(row.payload[key]));
}

function describe(
  { collection, recordId, payload }: schema.OutboxRow,
  albums: Map<string, schema.AlbumRow>,
  posts: Map<string, schema.PostRow>,
): string {
  switch (collection) {
    case 'albums':
      return `Album "${payload.name}"`;
    case 'posts':
      return `Post${snippet(String(payload.text ?? ''))}`;
    case 'assets':
      return describeAsset(payload);
    case 'album_assets': {
      const album = albums.get(String(payload.albumId));
      return album ? `Photo in album "${album.name}"` : 'Photo in an album';
    }
    case 'post_assets': {
      const post = posts.get(String(payload.postId));
      return post ? `Photo in post${snippet(post.text)}` : 'Photo in a post';
    }
    default:
      return `${collection} ${recordId}`;
  }
}

// ` "First words of the caption…"`, or nothing for an empty caption. Cut by code point, so an emoji
// is never split in half.
function snippet(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  const chars = Array.from(line);
  if (chars.length === 0) return '';
  return ` "${chars.length > SNIPPET_LENGTH ? `${chars.slice(0, SNIPPET_LENGTH).join('').trimEnd()}…` : line}"`;
}
