import type { PostRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type { AssetRef, ThreadPart } from '@/sync/postThreads';

// A post as an editor writes it: its fields, its photos (`assetRefs`) and its following posts
// (`threadPosts`, postThreads).
export type PostFields = Partial<PostRecord> & { assetRefs?: AssetRef[]; threadPosts?: ThreadPart[] };

// The post an editor was seeded with: what a changed photo list or thread is saved over.
export type PostSeed = { assetRefs?: AssetRef[]; threadPosts?: ThreadPart[] };

export type PostsContextValue = {
  addPost: (fields: PostFields) => Promise<PostRecord & { assetRefs: AssetRef[] }>;
  updatePost: (id: string, changes: PostFields, seed?: PostSeed | null) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
};

const PostsContext = createContext<PostsContextValue | null>(null);

export default PostsContext;
