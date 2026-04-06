import Icon from '@/components/Icon';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

import { SCREEN_PADDING } from '@/constants';
import { colors, scale, typography } from '@/styles/designTokens';

import PostImage from './PostImage';

import useAssets from '@/features/assets-context/useAssets';
import PostPostedAt from '@/features/posts/PostPostedAt';
import isPresent from '@/utils/isPresent';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';

// import { getPostAssetsWithAssets } from '@/utils/postUtils';

export default function PostListItem({ text, assetRefs, isFavorite, postedAt, suggestRepostAt }) {
  const { assets } = useAssets();
  const [postAssets, setPostAssets] = useState([]);

  useEffect(() => {
    setPostAssets(assetRefsToPostAssets(assetRefs, assets));
  }, [assetRefs]);

  return (
    <View style={styles.container}>
      {isPresent(postAssets) && <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} />}

      {isPresent(text) && <Text style={styles.postText}>{text}</Text>}

      <View style={styles.postInfos}>
        <PostPostedAt postedAt={postedAt} style={styles.postedAt} />
        {suggestRepostAt > Date.now() && (
          <View style={styles.postponedBadge}>
            <Icon name="clock" size={11} color={colors.textInverse} />
            <Text style={styles.postponedBadgeText}>Postponed</Text>
          </View>
        )}
      </View>

      <View style={styles.indicators}>
        <FavoritePostIndicator isFavorite={isFavorite} />
      </View>
    </View>
  );
}

function FavoritePostIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Icon name="heart" filled size={typography.lg} color={colors.textInverse} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SCREEN_PADDING,
  },
  postText: {
    fontSize: scale(15),
    marginTop: 10,
    lineHeight: 22,
  },

  postInfos: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postponedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.textTertiary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  postponedBadgeText: {
    fontSize: typography.xs,
    color: colors.textInverse,
    fontWeight: '600',
  },
  postedAt: {
    fontSize: scale(12),
    color: colors.textSecondary,
    fontWeight: 'bold',
  },

  indicators: {
    position: 'absolute',
    top: 25,
    left: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
