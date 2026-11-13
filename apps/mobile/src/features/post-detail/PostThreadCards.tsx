import { router } from 'expo-router';

import ThreadParts from '@/components/ThreadParts';
import assetHref from '@/features/asset-list/assetHref';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import type { AssetRow } from '@/sync/db/schema';
import type { PostWithAssets } from '@/sync/queries/postQuery';

type PostThreadCardsProps = {
  post: PostWithAssets & { threadPosts: PostWithAssets[] };
};

/**
 * A post's card (PostView) and its following posts' cards joined by the thread's line, as the post's
 * screen shows them (the post's own channel or another): a long press copies a text, and a picture
 * opens pushed, with the others of its own post.
 */
export default function PostThreadCards({ post }: PostThreadCardsProps) {
  function openAsset(postId: string, asset: Pick<AssetRow, 'id'>) {
    router.push(assetHref(asset.id, { scope: { postId } }));
  }

  return (
    <>
      <PostView post={post} onPressAsset={(asset) => openAsset(post.id, asset)} isTextSelectable />
      <ThreadParts
        parts={post.threadPosts}
        renderPart={(part) => (
          <ThreadPost post={part} onOpenAsset={(asset) => openAsset(part.id, asset)} isTextSelectable />
        )}
      />
    </>
  );
}
