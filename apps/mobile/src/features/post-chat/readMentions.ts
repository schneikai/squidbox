import readPostHandles from '@/features/post-mentions/readPostHandles';
import type { SyncDb } from '@/sync/db/types';
import { readMentionTexts } from '@/sync/postsRepository';

/**
 * The @handles the user mentions in posts like the one with these assets (readMentionTexts): those
 * of the posts of the assets' albums (`fromAlbum`), else of their newest posts; a chip's contact's
 * handles count too (postHandles).
 */
export default async function readMentions(
  db: SyncDb,
  assetIds: string[],
): Promise<{ handles: string[]; fromAlbum: boolean }> {
  const { posts, fromAlbum } = await readMentionTexts(db, assetIds);
  return { handles: await readPostHandles(db, posts), fromAlbum };
}
