import { router } from 'expo-router';

import ThreadParts from '@/components/ThreadParts';
import assetHref from '@/features/asset-list/assetHref';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import type { AssetRow } from '@/sync/db/schema';
import type { PostWithAssets } from '@/sync/queries/postQuery';

type PostThreadCardsProps = {
  post: PostWithAssets & { threadPosts: PostWithAssets[] };
  channelIds?: readonly string[];
};

/**
 * A post's card (PostView, with its `channelIds` as labels) and its following posts' cards joined by
 * the thread's line, as a post's screen and a channel's screen show them: a long press copies a text,
 * and a picture opens pushed, with the others of its own post.
 */
export default function PostThreadCards({ post, channelIds }: PostThreadCardsProps) {
  function openAsset(postId: string, asset: Pick<AssetRow, 'id'>) {
    router.push(assetHref(asset.id, { scope: { postId } }));
  }

  return (
    <>
      <PostView
        post={post}
        channelIds={channelIds}
        onPressAsset={(asset) => openAsset(post.id, asset)}
        isTextSelectable
      />
      <ThreadParts
        parts={post.threadPosts}
        renderPart={(part) => (
          <ThreadPost post={part} onOpenAsset={(asset) => openAsset(part.id, asset)} isTextSelectable />
        )}
      />
    </>
  );
}
