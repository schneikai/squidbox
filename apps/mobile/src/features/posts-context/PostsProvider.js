import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb, schema } from '@/sync/db/client';
import { assetRefsByPost } from '@/sync/derive';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import * as repo from '@/sync/postsRepository';
import { useLiveCollectionRows } from '@/sync/useCollection';
import { useDerivedRecords } from '@/sync/useDerivedRecords';
import { requestSync } from '@/sync/worker';
import postSchema from '@/utils/posts/postSchema';

// SQLite-backed posts store. Asset references live in the post_assets edge collection; `assetRefs`
// is synthesized here so consumers keep the old shape. postHistory is now derived (no side effects).
// Only mounted after the initial pull finishes (see AppGate), so it always reads the full library.
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

  // A user action that writes the post and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo(() => {
    const db = getDb();
    return {
      posts,
      addPost: async (data) => {
        const casted = postSchema.cast(data);
        const refs = casted.assetRefs ?? [];
        const post = await db.transaction(async (tx) => {
          const created = await repo.createPost(tx, toModernRecord(casted)); // `assetRefs` stripped by toModernRecord
          await edges.createFromRefs(tx, created.id, refs);
          return created;
        });
        requestSync();
        return { ...post, assetRefs: refs };
      },
      updatePost: async (id, updates) => {
        await db.transaction(async (tx) => {
          if ('assetRefs' in updates) await edges.setRefs(tx, id, updates.assetRefs ?? []);
          await repo.updatePost(tx, id, toModernChanges(updates)); // `assetRefs` stripped by toModernChanges
        });
        requestSync();
      },
      toggleFavoritePost: async (post) => {
        await repo.toggleFavorite(db, post.id);
        requestSync();
      },
      deletePost: async (id) => {
        if (!posts[id]) throw new Error(`Post ${id} not found.`);
        await db.transaction(async (tx) => {
          await repo.deletePosts(tx, [id]);
          await edges.tombstoneParent(tx, id);
        });
        requestSync();
      },
    };
  }, [posts]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
