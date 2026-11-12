import extractHandles from '@/lib/extractHandles';
import type { SyncDb } from '@/sync/db/types';
import { readMentionTexts } from '@/sync/postsRepository';

/**
 * The @handles the user mentions in posts like the one with these assets (readMentionTexts): those
 * of the posts of the assets' albums (`fromAlbum`), else of their newest posts.
 */
export default async function readMentions(
  db: SyncDb,
  assetIds: string[],
): Promise<{ handles: string[]; fromAlbum: boolean }> {
  const { texts, fromAlbum } = await readMentionTexts(db, assetIds);
  return { handles: extractHandles(texts), fromAlbum };
}
