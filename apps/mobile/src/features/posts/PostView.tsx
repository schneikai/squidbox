import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import PostImage, { type PostImageProps } from './PostImage';

import Card from '@/components/Card';
import ChipRow from '@/components/ChipRow';
import Text from '@/components/Text';
import ChannelLabel from '@/features/channels/ChannelLabel';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { layout, scale } from '@/styles/designTokens';
import type { PostWithAssets } from '@/sync/queries/postQuery';
import isPresent from '@/utils/isPresent';

type PostViewProps = {
  post: Pick<PostWithAssets, 'text' | 'postAssets' | 'postedAt'>;
  onPressAsset?: PostImageProps['onPressAsset'];
  isTextSelectable?: boolean;
  meta?: ReactNode;
  channelIds?: readonly string[];
  children?: ReactNode;
};

/**
 * A post as a card: its pictures (`onPressAsset(asset)` makes each open), its text (copied on a
 * long press with `isTextSelectable`), then a row with when it was posted and `meta` (what else the
 * place shows about it: a thread's size), and `children` under that row (buttons for this post).
 * `post` is a postQuery row: it carries its `postAssets` ([{ id, asset }]). `channelIds` are the
 * channels it is on, as labels at the card's top (ChannelLabel), in the order given; none for an empty list.
 */
export default function PostView({
  post,
  onPressAsset,
  isTextSelectable = false,
  meta,
  channelIds = [],
  children,
}: PostViewProps) {
  const { text, postAssets, postedAt } = post;

  return (
    <Card testID="post-card" style={styles.card}>
      {channelIds.length > 0 && (
        <ChipRow>
          {channelIds.map((channelId) => (
            <ChannelLabel key={channelId} channelId={channelId} />
          ))}
        </ChipRow>
      )}
      {isPresent(postAssets) && (
        <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} onPressAsset={onPressAsset} />
      )}
      <View style={[styles.body, !isPresent(postAssets) && styles.bodyTextOnly]}>
        {isPresent(text) && <Text selectable={isTextSelectable}>{text}</Text>}
        <View style={styles.meta}>
          <PostPostedAt postedAt={postedAt} />
          {meta}
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
});
