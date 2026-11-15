import chatMentions from './chatMentions';
import type { ListEdits } from './withEdits';

import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import mentionedContactIds from '@/features/post-mentions/mentionedContactIds';
import readMentionContacts from '@/features/post-mentions/readMentionContacts';
import { readPhotoAndAlbumContacts } from '@/sync/contactsRepository';
import type { SyncDb } from '@/sync/db/types';
import { readMentionTexts } from '@/sync/postsRepository';

/**
 * The contacts a post of these assets may mention, as the chat shows and sends them (chatMentions,
 * with the Mentions sheet's edits `mentionEdits`, contact ids): those the sheet added; those on the
 * photos and on their albums' photos (readPhotoAndAlbumContacts; those on the photos first); then
 * the contacts of the chips in the posts of their albums (readMentionTexts, mentionedContactIds), in
 * the most posts first. An added contact since deleted is left out. Only the chips' and the added
 * contacts are read, by id: a typed @handle in an older post is no mention here.
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
  const contactsById = await readMentionContacts(db, posts, mentionEdits.added);

  // How many posts mention each contact, in the order first seen.
  const postCounts = new Map<string, number>();
  for (const post of posts) {
    for (const id of mentionedContactIds(post, contactsById)) postCounts.set(id, (postCounts.get(id) ?? 0) + 1);
  }
  const ofPosts = [...postCounts].sort((a, b) => b[1] - a[1]).flatMap(([id]) => contactsById.get(id) ?? []);
  const added = mentionEdits.added.flatMap((id) => contactsById.get(id) ?? []);
  return chatMentions([...onPhotos, ...ofPosts], added, mentionEdits.removed);
}
