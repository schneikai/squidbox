import type { PostCopyRecord, PostRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type { CopyRef } from '@/sync/postCopiesRepository';
import type { AssetRef, ThreadPart } from '@/sync/postThreads';

// A post as an editor writes it: its fields, its photos (`assetRefs`) and its following posts
// (`threadPosts`, postThreads).
export type PostFields = Partial<PostRecord> & {
  assetRefs?: AssetRef[];
  threadPosts?: ThreadPart[];
};

// The post an editor was seeded with: what a changed photo list or thread is saved over.
export type PostSeed = Pick<PostFields, 'assetRefs' | 'threadPosts'>;

// A channel copy as a repost starts with it (post_copies): its channel, its posts and when it was saved.
export type PostCopyFields = Pick<PostCopyRecord, 'channelId' | 'posts' | 'editedAt'>;

export type PostsContextValue = {
  addPost: (fields: PostFields & { copies?: PostCopyFields[] }) => Promise<PostRecord & { assetRefs: AssetRef[] }>;
  updatePost: (id: string, changes: PostFields, seed?: PostSeed | null) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  addPostCopy: (postId: string, channelId: string) => Promise<void>;
  savePostCopy: (copy: CopyRef, posts: PostCopyFields['posts']) => Promise<void>;
  removePostCopy: (copy: CopyRef) => Promise<void>;
  setPostCopiesSent: (copies: CopyRef[], sentAt: number | null) => Promise<void>;
};

const PostsContext = createContext<PostsContextValue | null>(null);

export default PostsContext;
