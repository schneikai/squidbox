import contactAtHandles from '@/lib/contactAtHandles';
import extractHandles from '@/lib/extractHandles';
import { readPhotoAndAlbumContacts } from '@/sync/contactsRepository';
import type { SyncDb } from '@/sync/db/types';
import { readMentionTexts } from '@/sync/postsRepository';

/**
 * The @handles a post of these assets may mention: those of the contacts on the photos and on their
 * albums' photos (readPhotoAndAlbumContacts; those on the photos first), then those the user mentioned
 * in the posts of their albums (readMentionTexts, used most first), each once without case.
 */
export default async function readMentions(db: SyncDb, assetIds: string[]): Promise<{ handles: string[] }> {
  const [contacts, texts] = await Promise.all([
    readPhotoAndAlbumContacts(db, assetIds),
    readMentionTexts(db, assetIds),
  ]);
  const ofContacts = contacts.flatMap((contact) => contactAtHandles(contact).map(({ handle }) => `@${handle}`));
  const seen = new Set<string>();
  const handles = [...ofContacts, ...extractHandles(texts)].filter((handle) => {
    const key = handle.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { handles };
}
