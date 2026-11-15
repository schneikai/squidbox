import { router } from 'expo-router';

import ThreadParts from '@/components/ThreadParts';
import assetHref from '@/features/asset-list/assetHref';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import type { AssetRow } from '@/sync/db/schema';
import type { PostDetailRow } from '@/sync/queries/readPost';

// The post with the thread read with it, as readPost gives it.
type PostThreadCardsProps = {
  post: PostDetailRow;
  contactsById: ReadonlyMap<string, MentionContact>;
  onPressMention: (contactId: string) => void;
};

/**
 * A post's card (PostView) and its following posts' cards joined by the thread's line, as the post's
 * screen shows them: a long press copies a text without chips, a chip shows its contact
 * (`onPressMention`), and a picture
 * opens pushed, with the others of its own post.
 */
export default function PostThreadCards({ post, contactsById, onPressMention }: PostThreadCardsProps) {
  function openAsset(postId: string, asset: Pick<AssetRow, 'id'>) {
    router.push(assetHref(asset.id, { scope: { postId } }));
  }

  return (
    <>
      <PostView
        post={post}
        contactsById={contactsById}
        onPressMention={onPressMention}
        onPressAsset={(asset) => openAsset(post.id, asset)}
        isTextSelectable
      />
      <ThreadParts
        parts={post.threadPosts}
        renderPart={(part) => (
          <ThreadPost
            post={part}
            contactsById={contactsById}
            onPressMention={onPressMention}
            onOpenAsset={(asset) => openAsset(part.id, asset)}
            isTextSelectable
          />
        )}
      />
    </>
  );
}
