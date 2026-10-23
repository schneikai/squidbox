import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb, schema } from '@/sync/db/client';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import * as repo from '@/sync/postsRepository';
import { requestSync } from '@/sync/worker';
import postSchema from '@/utils/posts/postSchema';

// The post writes. Asset references live in the post_assets edge collection (`assetRefs` in, as the
// editor emits them). Screens read posts through their own live queries (postQuery).
const edges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

export default function PostsProvider({ children }) {
  // A user action that writes the post and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo(() => {
    const db = getDb();
    return {
      addPost: async (data) => {
        const casted = postSchema.cast(data);
        const refs = casted.assetRefs ?? [];
        const post = await db.transaction(async (tx) => {
          const created = await repo.create(tx, toModernRecord(casted)); // `assetRefs` stripped by toModernRecord
          await edges.createFromRefs(tx, created.id, refs);
          return created;
        });
        requestSync();
        return { ...post, assetRefs: refs };
      },
      // `seed`: the post an editor was seeded with, whose photo list a changed `assetRefs` is saved over.
      updatePost: async (id, updates, seed) => {
        await db.transaction(async (tx) => {
          if ('assetRefs' in updates) await edges.setRefs(tx, id, updates.assetRefs ?? [], seed?.assetRefs ?? []);
          await repo.update(tx, id, toModernChanges(updates)); // `assetRefs` stripped by toModernChanges
        });
        requestSync();
      },
      toggleFavoritePost: async (post) => {
        await repo.toggleFavorite(db, post.id);
        requestSync();
      },
      deletePost: async (id) => {
        await db.transaction(async (tx) => {
          await repo.remove(tx, [id]);
          await edges.tombstoneParent(tx, id);
        });
        requestSync();
      },
    };
  }, []);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
