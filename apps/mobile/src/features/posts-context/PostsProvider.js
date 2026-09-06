import { useMemo } from 'react';

import PostsContext from './PostsContext';

import { getDb, schema } from '@/sync/db/client';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionMap } from '@/sync/useCollection';
import { requestSync } from '@/sync/worker';
import postSchema from '@/utils/posts/postSchema';
import useUpdatePostHistory from '@/utils/posts/useUpdatePostHistory';

// SQLite-backed posts store (same API + post-history side effects). DB migrated by AssetsProvider.
const repo = makeRepository('posts', schema.posts);

export default function PostsProvider({ children }) {
  const posts = useLiveCollectionMap(schema.posts);
  const { addPostHistoryAsync, removePostHistoryAsync } = useUpdatePostHistory({ getPosts: () => posts });

  const value = useMemo(() => {
    const db = getDb();
    function updatePosts(ids, updates) {
      for (const id of ids) repo.update(db, id, toModernChanges(updates));
      requestSync();
    }
    return {
      posts,
      loadPostsAsync: async () => {},
      addPost: async (data) => {
        const post = repo.create(db, toModernRecord(postSchema.cast(data)));
        requestSync();
        await addPostHistoryAsync(post);
        return post;
      },
      updatePost: async (id, updates) => updatePosts([id], updates),
      toggleFavoritePost: async (post) => updatePosts([post.id], { isFavorite: !post.isFavorite }),
      deletePost: async (id) => {
        const post = posts[id];
        if (!post) throw new Error(`Post ${id} not found.`);
        await removePostHistoryAsync(post);
        repo.remove(db, [id]);
        requestSync();
      },
    };
  }, [posts]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
