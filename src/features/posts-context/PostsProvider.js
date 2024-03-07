import PostsContext from './PostsContext';

import useLoadAndUpdateData from '@/utils/local-data/useLoadAndUpdateData';
import loadPostsAsync from '@/utils/posts/loadPostsAsync';
import postSchema from '@/utils/posts/postSchema';
import useUpdatePostHistory from '@/utils/posts/useUpdatePostHistory';
import addAsync from '@/utils/state/addAsync';
import deleteAsync from '@/utils/state/deleteAsync';
import getModelsById from '@/utils/state/getModelsById';
import updateAsync from '@/utils/state/updateAsync';

export default function PostsProvider({ children }) {
  const { data: posts, setData: setPosts, initializeData } = useLoadAndUpdateData({ localDataFilename: 'posts.json' });
  const { addPostHistoryAsync, removePostHistoryAsync } = useUpdatePostHistory({ getPosts: () => posts });

  async function updatePosts(ids, updates) {
    updateAsync({
      models: getModelsById(ids, posts),
      updates,
      schema: postSchema,
      setState: setPosts,
    });
  }

  const value = {
    posts,
    loadPostsAsync: async () => {
      const posts = await loadPostsAsync();
      initializeData(posts);
    },
    addPost: async (data) => {
      const post = await addAsync({
        data,
        schema: postSchema,
        setState: setPosts,
      });

      await addPostHistoryAsync(post);

      return post;
    },
    updatePost: async (id, updates) => {
      await updatePosts([id], updates);
    },
    toggleFavoritePost: async (post) => {
      const isFavorite = !post.isFavorite;
      await updatePosts([post.id], { isFavorite });
    },
    // TODO: We have setXYDeleted for Assets and Albums. Should we have one for Posts?
    deletePost: async (id) => {
      const post = posts[id];
      if (!post) throw new Error(`Post ${id} not found.`);

      await removePostHistoryAsync(post);
      await deleteAsync({ ids: [id], setState: setPosts });
    },
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
