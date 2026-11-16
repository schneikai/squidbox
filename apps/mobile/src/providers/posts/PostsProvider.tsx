import { postCollection, type PostRecord } from '@squidbox/shared';
import { type ReactNode, useMemo } from 'react';

import PostsContext, { type PostsContextValue } from './PostsContext';

import { createCopy, removeCopies, restoreCopies, setCopiesSent, updateCopyPosts } from '@/sync/postCopiesRepository';
import { removeThreads, saveThreadPosts, setThreadsPostedAt } from '@/sync/postThreads';
import * as repo from '@/sync/postsRepository';
import written from '@/sync/written';
import newRecord from '@/utils/newRecord';

type PostsProviderProps = { children: ReactNode };

// The post writes. Asset references live in the post_assets edge collection (`assetRefs` in, as the
// editor emits them); a thread's following posts are `threadPosts` (`[{ id, text, mentions, assetRefs }]`,
// postThreads); its channel copies are post_copies records (postCopiesRepository), created with it
// for a repost (`copies`). Screens read posts through their own live queries (postQuery).

export default function PostsProvider({ children }: PostsProviderProps) {
  // A user action that writes the post and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo<PostsContextValue>(() => {
    return {
      addPost: async ({ assetRefs: refs = [], threadPosts = [], copies = [], ...fields }) => {
        const post = await written(async (tx) => {
          const created = await repo.create(tx, newRecord(postCollection, postDefaults, fields));
          await repo.postEdges.createFromRefs(tx, created.id, refs);
          await saveThreadPosts(tx, created.id, threadPosts, [], newPart);
          // A repost's copies of channels no longer in the user's channels keep the reposted post's
          // order: one millisecond apart.
          for (const [index, copy] of copies.entries())
            await createCopy(tx, { postId: created.id, ...copy, createdAt: created.createdAt + index });
          return created;
        });
        return { ...post, assetRefs: refs };
      },
      // `seed`: the post an editor was seeded with, whose photo list and following posts a changed
      // `assetRefs` / `threadPosts` is saved over. A changed `postedAt` applies to the whole thread.
      updatePost: async (id, { assetRefs, threadPosts, ...changes }, seed) => {
        await written(async (tx) => {
          if (assetRefs !== undefined) await repo.postEdges.setRefs(tx, id, assetRefs ?? [], seed?.assetRefs ?? []);
          await repo.update(tx, id, changes);
          if (changes.postedAt !== undefined) await setThreadsPostedAt(tx, [id], changes.postedAt);
          if (threadPosts !== undefined) await saveThreadPosts(tx, id, threadPosts, seed?.threadPosts ?? [], newPart);
        });
      },
      // The post, its thread and its channel copies.
      deletePost: (id) => written((tx) => removeThreads(tx, [id])),
      // Send to channels' cards, an untouched one stored with the write (postCopiesRepository).
      addPostCopy: (postId, channelId) => written((tx) => restoreCopies(tx, postId, channelId)),
      savePostCopy: (copy, posts) => written((tx) => updateCopyPosts(tx, copy, posts)),
      removePostCopy: (copy) => written((tx) => removeCopies(tx, [copy])),
      setPostCopiesSent: (copies, sentAt) => written((tx) => setCopiesSent(tx, copies, sentAt)),
    };
  }, []);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

// How saveThreadPosts builds a new following post: a new post's defaults, the thread's Posted time.
function newPart(fields: Partial<PostRecord>): PostRecord {
  return newRecord(postCollection, postDefaults, fields);
}

// A new post is unposted and offered for a repost from its creation on.
function postDefaults({ createdAt }: Pick<PostRecord, 'createdAt'>): Partial<PostRecord> {
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
