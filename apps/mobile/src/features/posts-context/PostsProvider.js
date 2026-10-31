import { postCollection } from '@squidbox/shared';
import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb } from '@/sync/db/client';
import { postEdges as edges, removeThread, saveThreadPosts, setThreadPostedAt } from '@/sync/postThreads';
import * as repo from '@/sync/postsRepository';
import { requestSync } from '@/sync/worker';
import newRecord from '@/utils/newRecord';

// The post writes. Asset references live in the post_assets edge collection (`assetRefs` in, as the
// editor emits them); a thread's following posts are `threadPosts` (`[{ id, text, assetRefs }]`,
// postThreads). Screens read posts through their own live queries (postQuery).

export default function PostsProvider({ children }) {
  // A user action that writes the post and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo(() => {
    const db = getDb();
    return {
      addPost: async ({ assetRefs: refs = [], threadPosts = [], ...fields }) => {
        const post = await db.transaction(async (tx) => {
          const created = await repo.create(tx, newRecord(postCollection, postDefaults, fields));
          await edges.createFromRefs(tx, created.id, refs);
          await saveThreadPosts(tx, created.id, threadPosts, [], threadOptions(created.postedAt));
          return created;
        });
        requestSync();
        return { ...post, assetRefs: refs };
      },
      // `seed`: the post an editor was seeded with, whose photo list and following posts a changed
      // `assetRefs` / `threadPosts` is saved over. A changed `postedAt` applies to the whole thread.
      updatePost: async (id, { assetRefs, threadPosts, ...changes }, seed) => {
        await db.transaction(async (tx) => {
          if (assetRefs !== undefined) await edges.setRefs(tx, id, assetRefs ?? [], seed?.assetRefs ?? []);
          await repo.update(tx, id, changes);
          if (changes.postedAt !== undefined) await setThreadPostedAt(tx, id, changes.postedAt);
          if (threadPosts !== undefined) {
            const postedAt = changes.postedAt !== undefined ? changes.postedAt : (seed?.postedAt ?? null);
            await saveThreadPosts(tx, id, threadPosts, seed?.threadPosts ?? [], threadOptions(postedAt));
          }
        });
        requestSync();
      },
      toggleFavoritePost: async (post) => {
        await repo.toggleFavorite(db, post.id);
        requestSync();
      },
      deletePost: async (id) => {
        await db.transaction((tx) => removeThread(tx, id));
        requestSync();
      },
    };
  }, []);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

// How saveThreadPosts builds a new following post: a new post's defaults, the thread's Posted time.
function threadOptions(postedAt) {
  return { postedAt, newPart: (fields) => newRecord(postCollection, postDefaults, fields) };
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
