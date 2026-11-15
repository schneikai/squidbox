import chatMentions from './chatMentions';
import type { ListEdits } from './withEdits';

import contactsByHandle from '@/features/post-mentions/contactsByHandle';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import mentionedContactIds from '@/features/post-mentions/mentionedContactIds';
import extractHandles from '@/lib/extractHandles';
import { readPhotoAndAlbumContacts } from '@/sync/contactsRepository';
import type { SyncDb } from '@/sync/db/types';
import { readMentionTexts } from '@/sync/postsRepository';
import contactQuery from '@/sync/queries/contactQuery';

/**
 * The contacts a post of these assets may mention, as the chat shows and sends them (chatMentions,
 * with the Mentions sheet's edits `mentionEdits`, contact ids): those the sheet added; those on the
 * photos and on their albums' photos (readPhotoAndAlbumContacts; those on the photos first); then
 * those the user mentioned in the posts of their albums (readMentionTexts; mentionedContactIds: a
 * chip's live contact, each contact a typed @handle means), in the most posts first. An added contact
 * since deleted is left out. Every contact is read only when an album post holds a typed @handle;
 * else only the chips' and the added ones, by id.
 */
export default async function readMentions(
  db: SyncDb,
  assetIds: string[],
  mentionEdits: ListEdits,
): Promise<MentionContact[]> {
  const [onPhotos, posts] = await Promise.all([
    readPhotoAndAlbumContacts(db, assetIds),
    readMentionTexts(db, assetIds),
  ]);
  const hasTyped = extractHandles(posts.map((post) => post.text)).length > 0;
  const ids = [
    ...new Set([...posts.flatMap((post) => (post.mentions ?? []).map((m) => m.contactId)), ...mentionEdits.added]),
  ];
  const contacts = hasTyped
    ? await contactQuery({}).summaries(db)
    : ids.length > 0
      ? await contactQuery({ scope: { ids } }).summaries(db)
      : [];
  const contactsById = new Map<string, MentionContact>(contacts.map((contact) => [contact.id, contact]));
  const ofHandle = contactsByHandle(contacts);

  // How many posts mention each contact, in the order first seen.
  const postCounts = new Map<string, number>();
  for (const post of posts) {
    for (const id of mentionedContactIds(post, contactsById, ofHandle))
      postCounts.set(id, (postCounts.get(id) ?? 0) + 1);
  }
  const ofPosts = [...postCounts].sort((a, b) => b[1] - a[1]).flatMap(([id]) => contactsById.get(id) ?? []);
  const added = mentionEdits.added.flatMap((id) => contactsById.get(id) ?? []);
  return chatMentions([...onPhotos, ...ofPosts], added, mentionEdits.removed);
}
