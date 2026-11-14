import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import CopyTextButton from './CopyTextButton';
import PostImage, { type PostImageProps } from './PostImage';

import Card from '@/components/Card';
import Text from '@/components/Text';
import ChannelLogos from '@/features/channels/ChannelLogos';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { layout, scale } from '@/styles/designTokens';
import type { PostWithAssets } from '@/sync/queries/postQuery';
import isPresent from '@/utils/isPresent';

type PostViewProps = {
  post: Pick<PostWithAssets, 'text' | 'postAssets' | 'postedAt'>;
  onPressAsset?: PostImageProps['onPressAsset'];
  isCopyable?: boolean;
  meta?: ReactNode;
  channelIds?: readonly string[];
  children?: ReactNode;
};

/**
 * A post as a card: its pictures (`onPressAsset(asset)` makes each open), its text, then a row with
 * when it was posted and `meta` (what else the place shows about it: a thread's size), with
 * `isCopyable` a copy icon at its right end (CopyTextButton) when there is text, and `children` under that row (buttons for this post).
 * `post` is a postQuery row: it carries its `postAssets` ([{ id, asset }]). `channelIds` are the
 * channels it is on, as plain logos at the card's top (ChannelLogos), in the order given; none
 * for an empty list.
 */
export default function PostView({
  post,
  onPressAsset,
  isCopyable = false,
  meta,
  channelIds = [],
  children,
}: PostViewProps) {
  const { text, postAssets, postedAt } = post;

  return (
    <Card testID="post-card" style={styles.card}>
      <ChannelLogos channelIds={channelIds} />
      {isPresent(postAssets) && (
        <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} onPressAsset={onPressAsset} />
      )}
      <View style={[styles.body, !isPresent(postAssets) && styles.bodyTextOnly]}>
        {isPresent(text) && <Text>{text}</Text>}
        <View style={styles.meta}>
          <PostPostedAt postedAt={postedAt} />
          {meta}
          {isCopyable && isPresent(text) && <CopyTextButton text={text} style={styles.copy} />}
        </View>
        {children}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: layout.postCardPadding,
    gap: layout.postCardGap,
  },
  body: {
    paddingHorizontal: layout.postTextInset,
    paddingBottom: layout.postTextBottom,
    gap: layout.cardGap,
  },
  // Without pictures the text starts as far from the card's top as from its sides.
  bodyTextOnly: {
    paddingTop: layout.postTextInset,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.cardGap,
    minHeight: scale(20),
  },
  // At the row's right end, the card's bottom right.
  copy: {
    marginLeft: 'auto',
  },
});
