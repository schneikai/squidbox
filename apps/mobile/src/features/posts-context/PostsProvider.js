import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb, schema } from '@/sync/db/client';
import { assetRefsByPost } from '@/sync/derive';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionRows } from '@/sync/useCollection';
import { useDerivedRecords } from '@/sync/useDerivedRecords';
import { requestSync } from '@/sync/worker';
import postSchema from '@/utils/posts/postSchema';

// SQLite-backed posts store. Asset references live in the post_assets edge collection; `assetRefs`
// is synthesized here so consumers keep the old shape. postHistory is now derived (no side effects).
// Only mounted after the initial pull finishes (see AppGate), so it always reads the full library.
const repo = makeRepository('posts', schema.posts);
const edges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

const NO_REFS = [];

export default function PostsProvider({ children }) {
  const postRows = useLiveCollectionRows(schema.posts);
  const postEdges = useLiveCollectionRows(schema.postAssets);

  const assetRefsOf = useMemo(() => {
    const refsByPost = assetRefsByPost(postEdges);
    return (row) => ({ assetRefs: refsByPost[row.id] ?? NO_REFS });
  }, [postEdges]);
  const posts = useDerivedRecords(postRows, assetRefsOf);

  const value = useMemo(() => {
    const db = getDb();
    return {
      posts,
      addPost: async (data) => {
        const casted = postSchema.cast(data);
        const refs = casted.assetRefs ?? [];
        const post = await repo.create(db, toModernRecord(casted)); // `assetRefs` stripped by toModernRecord
        await edges.createFromRefs(db, post.id, refs);
        requestSync();
        return { ...post, assetRefs: refs };
      },
      updatePost: async (id, updates) => {
        if ('assetRefs' in updates) await edges.setRefs(db, id, updates.assetRefs ?? []);
        await repo.update(db, id, toModernChanges(updates)); // `assetRefs` stripped by toModernChanges
        requestSync();
      },
      toggleFavoritePost: async (post) => {
        await repo.update(db, post.id, { isFavorite: !post.isFavorite });
        requestSync();
      },
      deletePost: async (id) => {
        const post = posts[id];
        if (!post) throw new Error(`Post ${id} not found.`);
        await repo.remove(db, [id]);
        await edges.tombstoneParent(db, id);
        requestSync();
      },
    };
  }, [posts]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
