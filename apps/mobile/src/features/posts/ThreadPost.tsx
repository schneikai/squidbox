import type { Channel } from '@squidbox/shared';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import PostRowCard from './PostRowCard';

import CopyPostTextButton from '@/features/post-mentions/CopyPostTextButton';
import MentionText from '@/features/post-mentions/MentionText';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import type { AssetRow } from '@/sync/db/schema';
import type { PostWithAssets } from '@/sync/queries/postQuery';
import isPresent from '@/utils/isPresent';

type PostRowCardProps = ComponentProps<typeof PostRowCard>;

type ThreadPostProps = {
  post: Pick<PostWithAssets, 'text' | 'mentions' | 'postAssets'>;
  contactsById: ReadonlyMap<string, MentionContact>;
  /** The channel a copy is for: its chips read, and its text is copied, as the contacts' handles there. */
  channel?: Pick<Channel, 'id' | 'handleField'>;
  onPressMention?: (contactId: string) => void;
  onOpenAsset?: (asset: AssetRow) => void;
  isCopyable?: boolean;
  entering?: PostRowCardProps['entering'];
  exiting?: PostRowCardProps['exiting'];
  style?: PostRowCardProps['style'];
  contentStyle?: PostRowCardProps['contentStyle'];
  contentExiting?: PostRowCardProps['contentExiting'];
};

/**
 * A following post of a thread as a row card (the post screen, an unfolded thread in the posts
 * list): its first picture as a tile ("+N" when it has more), its text beside it, its mentions as chips (MentionText; a tap on one to `onPressMention`, left out inside something pressable). With
 * `onOpenAsset(asset)` a tap on the tile opens the picture; without it (inside something pressable,
 * the posts list) the tile takes no touch. With `isCopyable` a copy icon
 * sits at the card's bottom right (CopyPostTextButton).
 * `entering` and `exiting` are Reanimated layout animations of the card, and `contentStyle` and
 * `contentExiting` an animated style and exiting animation of what's in it (an unfolding thread's);
 * `style` is for layout only.
 */
export default function ThreadPost({
  post,
  contactsById,
  channel,
  onPressMention,
  onOpenAsset,
  isCopyable = false,
  entering,
  exiting,
  style,
  contentStyle,
  contentExiting,
}: ThreadPostProps) {
  const [first, ...more] = post.postAssets.map((postAsset) => postAsset.asset);

  return (
    <PostRowCard
      asset={first}
      moreCount={more.length}
      onPressAsset={onOpenAsset && (() => onOpenAsset(first))}
      entering={entering}
      exiting={exiting}
      style={style}
      contentStyle={contentStyle}
      contentExiting={contentExiting}
    >
      {isPresent(post.text) && (
        <MentionText value={post} contactsById={contactsById} channel={channel} onPressMention={onPressMention} />
      )}
      {isCopyable && isPresent(post.text) && <CopyPostTextButton post={post} channel={channel} style={styles.copy} />}
    </PostRowCard>
  );
}

const styles = StyleSheet.create({
  // At the card's bottom right, however tall the picture beside the text makes it.
  copy: {
    alignSelf: 'flex-end',
    marginTop: 'auto',
  },
});
