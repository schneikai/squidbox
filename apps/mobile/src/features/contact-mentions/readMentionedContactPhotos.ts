import { and, eq, isNull } from 'drizzle-orm';

import mentionedContactIds from '@/features/post-mentions/mentionedContactIds';
import readContactsByHandle from '@/features/post-mentions/readContactsByHandle';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { listedPostId, mentionsSomeone } from '@/sync/postsRepository';

/** What the posts' mentions match: each contact's photos, and how many posts matched (as listed: listedPostId). */
export type MentionedContactPhotos = { photosByContact: Map<string, string[]>; postCount: number };

/**
 * For every live post that mentions a live contact (mentionedContactIds: a chip, or an @handle that
 * is the contact's, contactsByHandle), that contact and the post's live photos. A handle that several
 * contacts have matches each of them. One transaction.
 */
export default function readMentionedContactPhotos(db: SyncDb): Promise<MentionedContactPhotos> {
  return db.transaction(async (tx) => {
    const p = schema.posts;
    const posts = await tx
      .select({ id: p.id, listedId: listedPostId('posts'), text: p.text, mentions: p.mentions })
      .from(p)
      .where(mentionsSomeone(p));
    const { contactsById, ofHandle } = await readContactsByHandle(tx);

    const contactsByPost = new Map<string, string[]>();
    // A thread's following posts are its first post: it counts once.
    const listedPosts = new Set<string>();
    for (const post of posts) {
      const ids = mentionedContactIds(post, contactsById, ofHandle);
      if (ids.length === 0) continue;
      contactsByPost.set(post.id, ids);
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
