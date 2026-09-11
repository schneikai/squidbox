import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb, schema } from '@/sync/db/client';
import { assetRefsByPost } from '@/sync/derive';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionMap, useLiveCollectionRows } from '@/sync/useCollection';
import { useFirstSyncPending } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';
import postSchema from '@/utils/posts/postSchema';

// SQLite-backed posts store. Asset references live in the post_assets edge collection; `assetRefs`
// is synthesized here so consumers keep the old shape. postHistory is now derived (no side effects).
const repo = makeRepository('posts', schema.posts);
const edges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

export default function PostsProvider({ children }) {
  const firstSyncPending = useFirstSyncPending();
  // Pause the heavy full-table reads during the initial bulk sync (UI is gated behind FirstSyncScreen).
  const postRows = useLiveCollectionMap(schema.posts, firstSyncPending);
  const postEdges = useLiveCollectionRows(schema.postAssets, firstSyncPending);

  const posts = useMemo(() => {
    if (firstSyncPending) return postRows;
    const refsByPost = assetRefsByPost(postEdges);
    const out = {};
    for (const [id, row] of Object.entries(postRows)) out[id] = { ...row, assetRefs: refsByPost[id] ?? [] };
    return out;
  }, [postRows, postEdges, firstSyncPending]);

  const value = useMemo(() => {
    const db = getDb();
    return {
      posts,
      loadPostsAsync: async () => {},
      addPost: async (data) => {
        const casted = postSchema.cast(data);
        const refs = casted.assetRefs ?? [];
        const post = repo.create(db, toModernRecord(casted)); // `assetRefs` stripped by toModernRecord
        edges.createFromRefs(db, post.id, refs);
        requestSync();
        return { ...post, assetRefs: refs };
      },
      updatePost: async (id, updates) => {
        if ('assetRefs' in updates) edges.setRefs(db, id, updates.assetRefs ?? []);
        repo.update(db, id, toModernChanges(updates)); // `assetRefs` stripped by toModernChanges
        requestSync();
      },
      toggleFavoritePost: async (post) => {
        repo.update(db, post.id, { isFavorite: !post.isFavorite });
        requestSync();
      },
      deletePost: async (id) => {
        const post = posts[id];
        if (!post) throw new Error(`Post ${id} not found.`);
        repo.remove(db, [id]);
        edges.tombstoneParent(db, id);
        requestSync();
      },
    };
  }, [posts]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
