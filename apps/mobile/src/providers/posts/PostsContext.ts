import type { PostCopyRecord, PostRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type { AssetRef, ThreadPart } from '@/sync/postThreads';

// A post as an editor writes it: its fields, its photos (`assetRefs`) and its following posts
// (`threadPosts`, postThreads).
export type PostFields = Partial<PostRecord> & {
  assetRefs?: AssetRef[];
  threadPosts?: ThreadPart[];
};

// The post an editor was seeded with: what a changed photo list or thread is saved over.
export type PostSeed = Pick<PostFields, 'assetRefs' | 'threadPosts'>;

// A channel copy as its composer writes it (post_copies): its channel and its posts.
export type PostCopyFields = Pick<PostCopyRecord, 'channelId' | 'posts'>;

export type PostsContextValue = {
  addPost: (fields: PostFields & { copies?: PostCopyFields[] }) => Promise<PostRecord & { assetRefs: AssetRef[] }>;
  updatePost: (id: string, changes: PostFields, seed?: PostSeed | null) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  addPostCopy: (postId: string, copy: PostCopyFields) => Promise<void>;
  updatePostCopy: (id: string, posts: PostCopyFields['posts']) => Promise<void>;
  removePostCopy: (id: string) => Promise<void>;
  setPostCopiesSent: (ids: string[], sentAt: number | null) => Promise<void>;
};

const PostsContext = createContext<PostsContextValue | null>(null);

export default PostsContext;
