import { View, StyleSheet, Text } from 'react-native';

import PostImage from './PostImage';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { colors, spacing, typography } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

// `post` is a postQuery row: it carries its `postAssets` ([{ id, asset }]).
export default function PostListItem({ post }) {
  const { text, postAssets, isFavorite, postedAt } = post;

  return (
    <View style={styles.container}>
      {isPresent(postAssets) && <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} />}

      {isPresent(text) && <Text style={styles.postText}>{text}</Text>}

      <View style={styles.postInfos}>
        <PostPostedAt postedAt={postedAt} />
      </View>

      <View style={styles.indicators}>
        <FavoritePostIndicator isFavorite={isFavorite} />
      </View>
    </View>
  );
}

function FavoritePostIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Icon name="heart" filled size={spacing.iconSize} color={colors.textInverse} />;
}

const styles = StyleSheet.create({
  // Nothing above the post, so the list's top padding alone sets where the first one starts; the
  // room between posts is all below each.
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING * 2,
  },
  postText: {
    fontSize: typography.subheadline,
    marginTop: 10,
    lineHeight: 22,
  },

  postInfos: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  indicators: {
    position: 'absolute',
    top: 25 - SCREEN_PADDING,
    left: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
