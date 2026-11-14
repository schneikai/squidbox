import { router } from 'expo-router';

import ThreadParts from '@/components/ThreadParts';
import assetHref from '@/features/asset-list/assetHref';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import type { AssetRow } from '@/sync/db/schema';
import type { ChannelPostRow } from '@/sync/queries/readPost';

// The post or another version of it: the thread read with it, its channels as readPost gives them.
type PostThreadCardsProps = { post: ChannelPostRow };

/**
 * A post's card (PostView) and its following posts' cards joined by the thread's line, as the post's
 * screen shows them (the post's own channel or another): each text with a copy icon, and a picture
 * opens pushed, with the others of its own post.
 */
export default function PostThreadCards({ post }: PostThreadCardsProps) {
  function openAsset(postId: string, asset: Pick<AssetRow, 'id'>) {
    router.push(assetHref(asset.id, { scope: { postId } }));
  }

  return (
    <>
      <PostView post={post} onPressAsset={(asset) => openAsset(post.id, asset)} isCopyable />
      <ThreadParts
        parts={post.threadPosts}
        renderPart={(part) => <ThreadPost post={part} onOpenAsset={(asset) => openAsset(part.id, asset)} isCopyable />}
      />
    </>
  );
}
