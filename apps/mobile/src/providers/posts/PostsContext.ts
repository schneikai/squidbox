import type { PostRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type { ChannelPart } from '@/sync/postChannels';
import type { AssetRef, ThreadPart } from '@/sync/postThreads';

// A post as an editor writes it: its fields, its channels (`channelIds`, versionChannelFields: the only
// way to set them), its photos (`assetRefs`), its following posts (`threadPosts`, postThreads) and its
// other versions (`channelPosts`, postChannels).
export type PostFields = Omit<Partial<PostRecord>, 'channelId' | 'extraChannelIds'> & {
  channelIds?: string[];
  assetRefs?: AssetRef[];
  threadPosts?: ThreadPart[];
  channelPosts?: ChannelPart[];
};

// The post an editor was seeded with: what a changed photo list, thread or other channels are saved over.
export type PostSeed = Pick<PostFields, 'assetRefs' | 'threadPosts' | 'channelPosts'>;

export type PostsContextValue = {
  addPost: (fields: PostFields) => Promise<PostRecord & { assetRefs: AssetRef[] }>;
  updatePost: (id: string, changes: PostFields, seed?: PostSeed | null) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
};

const PostsContext = createContext<PostsContextValue | null>(null);

export default PostsContext;
