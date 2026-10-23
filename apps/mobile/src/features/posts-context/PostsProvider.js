import { postCollection } from '@squidbox/shared';
import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb, schema } from '@/sync/db/client';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import * as repo from '@/sync/postsRepository';
import { requestSync } from '@/sync/worker';
import newRecord from '@/utils/newRecord';

// The post writes. Asset references live in the post_assets edge collection (`assetRefs` in, as the
// editor emits them). Screens read posts through their own live queries (postQuery).
const edges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

export default function PostsProvider({ children }) {
  // A user action that writes the post and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo(() => {
    const db = getDb();
    return {
      addPost: async ({ assetRefs: refs = [], ...fields }) => {
        const post = await db.transaction(async (tx) => {
          const created = await repo.create(tx, newRecord(postCollection, postDefaults, fields));
          await edges.createFromRefs(tx, created.id, refs);
          return created;
        });
        requestSync();
        return { ...post, assetRefs: refs };
      },
      // `seed`: the post an editor was seeded with, whose photo list a changed `assetRefs` is saved over.
      updatePost: async (id, { assetRefs, ...changes }, seed) => {
        await db.transaction(async (tx) => {
          if (assetRefs !== undefined) await edges.setRefs(tx, id, assetRefs ?? [], seed?.assetRefs ?? []);
          await repo.update(tx, id, changes);
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

// A new post is unposted and offered for a repost from its creation on.
function postDefaults({ createdAt }) {
  return {
    text: '',
    isFavorite: false,
    postedAt: null,
    rePostId: null,
    isIgnoredForRepost: false,
    suggestRepostAt: createdAt,
    hasBeenReposted: false,
  };
}
