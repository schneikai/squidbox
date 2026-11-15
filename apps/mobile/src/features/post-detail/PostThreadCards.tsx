import type { Channel } from '@squidbox/shared';
import { router } from 'expo-router';

import ThreadParts from '@/components/ThreadParts';
import assetHref from '@/features/asset-list/assetHref';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import type { AssetRow } from '@/sync/db/schema';
import type { PostWithAssets } from '@/sync/queries/postQuery';

type ThreadCardPart = Pick<PostWithAssets, 'id' | 'text' | 'mentions' | 'postAssets'>;

// The post with the thread read with it (readPost's), or a channel copy's posts in that shape.
type PostThreadCardsProps = {
  post: ThreadCardPart & Pick<PostWithAssets, 'postedAt'> & { threadPosts: ThreadCardPart[] };
  contactsById: ReadonlyMap<string, MentionContact>;
  /** The channel a copy is for: its chips read, and its texts are copied, as the contacts' handles there. */
  channel?: Pick<Channel, 'id' | 'handleField'>;
  onPressMention: (contactId: string) => void;
  /** Whether a picture opens (a saved post's do; a copy's are only shown). */
  opensAssets?: boolean;
};

/**
 * A post's card (PostView) and its following posts' cards joined by the thread's line, as the post's
 * screen shows them: a chip shows its contact (`onPressMention`), each text with a copy icon (as
 * `channel` gets it, for a copy's), and, with `opensAssets`, a picture opens pushed, with the others
 * of its own post.
 */
export default function PostThreadCards({
  post,
  contactsById,
  channel,
  onPressMention,
  opensAssets = true,
}: PostThreadCardsProps) {
  function openAsset(postId: string, asset: Pick<AssetRow, 'id'>) {
    router.push(assetHref(asset.id, { scope: { postId } }));
  }

  return (
    <>
      <PostView
        post={post}
        contactsById={contactsById}
        channel={channel}
        onPressMention={onPressMention}
        onPressAsset={opensAssets ? (asset) => openAsset(post.id, asset) : undefined}
        isCopyable
      />
      <ThreadParts
        parts={post.threadPosts}
        renderPart={(part) => (
          <ThreadPost
            post={part}
            contactsById={contactsById}
            channel={channel}
            onPressMention={onPressMention}
            onOpenAsset={opensAssets ? (asset) => openAsset(part.id, asset) : undefined}
            isCopyable
          />
        )}
      />
    </>
  );
}
