import { CONTACT_HANDLE_FIELDS, handleKey } from '@squidbox/shared';
import { and, eq, isNotNull, isNull, like, or } from 'drizzle-orm';

import mentionParts from '@/features/post-mentions/mentionParts';
import extractHandles from '@/lib/extractHandles';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { listedPostId } from '@/sync/postsRepository';

// The suffix a Bluesky handle may be mentioned without (`@maya` for `maya.bsky.social`).
const BLUESKY_SUFFIX = '.bsky.social';

/** What the posts' mentions match: each contact's photos, and how many posts matched (as listed: listedPostId). */
export type MentionedContactPhotos = { photosByContact: Map<string, string[]>; postCount: number };

/**
 * For every live post with an @handle that is a live contact's handle (any of CONTACT_HANDLES,
 * without case; a Bluesky handle also without `.bsky.social`), or with a chip of a live contact
 * (mentionParts), that contact and the post's live photos. A handle that several contacts have
 * matches each of them. One transaction.
 */
export default function readMentionedContactPhotos(db: SyncDb): Promise<MentionedContactPhotos> {
  return db.transaction(async (tx) => {
    const p = schema.posts;
    const posts = await tx
      .select({ id: p.id, listedId: listedPostId('posts'), text: p.text, mentions: p.mentions })
      .from(p)
      .where(and(isNull(p.deletedAt), or(like(p.text, '%@%'), isNotNull(p.mentions))));
    const { contactsByHandle, liveIds } = await readLiveContacts(tx);

    const contactsByPost = new Map<string, string[]>();
    // A thread's following posts are its first post: it counts once.
    const listedPosts = new Set<string>();
    for (const post of posts) {
      const chips = mentionParts(post.text, post.mentions).flatMap((part) =>
        part.kind === 'mention' && liveIds.has(part.mention.contactId) ? [part.mention.contactId] : [],
      );
      const ids = new Set([
        ...extractHandles([post.text]).flatMap((handle) => contactsByHandle.get(handleKey(handle)) ?? []),
        ...chips,
      ]);
      if (ids.size === 0) continue;
      contactsByPost.set(post.id, [...ids]);
      listedPosts.add(post.listedId);
    }

    const photosByContact = new Map<string, Set<string>>();
    for (const { postId, assetId } of await readPostPhotos(tx, [...contactsByPost.keys()])) {
      for (const contactId of contactsByPost.get(postId) ?? []) {
        const photos = photosByContact.get(contactId) ?? new Set<string>();
        photos.add(assetId);
        photosByContact.set(contactId, photos);
      }
    }
    return {
      photosByContact: new Map([...photosByContact].map(([contactId, photos]) => [contactId, [...photos]])),
      postCount: listedPosts.size,
    };
  });
}

// The live contacts' ids, and the ids by each of their handles' keys (handleKey).
async function readLiveContacts(
  tx: SyncDb,
): Promise<{ contactsByHandle: Map<string, string[]>; liveIds: Set<string> }> {
  const c = schema.contacts;
  const contacts = await tx.select().from(c).where(isNull(c.deletedAt));
  const byHandle = new Map<string, string[]>();
  const add = (handle: string, contactId: string) => {
    const ids = byHandle.get(handle) ?? [];
    if (!ids.includes(contactId)) byHandle.set(handle, [...ids, contactId]);
  };
  for (const contact of contacts) {
    for (const field of CONTACT_HANDLE_FIELDS) {
      const handle = handleKey(contact[field] ?? '', field);
      if (!handle) continue;
      add(handle, contact.id);
      if (field === 'blueskyHandle' && handle.endsWith(BLUESKY_SUFFIX))
        add(handle.slice(0, -BLUESKY_SUFFIX.length), contact.id);
    }
  }
  return { contactsByHandle: byHandle, liveIds: new Set(contacts.map((contact) => contact.id)) };
}

// The live photos of these posts, through their live edges.
async function readPostPhotos(tx: SyncDb, postIds: string[]): Promise<{ postId: string; assetId: string }[]> {
  if (postIds.length === 0) return [];
  const pa = schema.postAssets;
  const a = schema.assets;
  return tx
    .select({ postId: pa.postId, assetId: pa.assetId })
    .from(pa)
    .innerJoin(a, and(eq(a.id, pa.assetId), isNull(a.deletedAt)))
    .where(and(isNull(pa.deletedAt), inJson(pa.postId, postIds)));
}
