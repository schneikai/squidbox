import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import assetAlbumsQuery from './assetAlbumsQuery';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import useShowAssetPosts from '@/features/asset-detail/useShowAssetPosts';
import postQuery from '@/features/post-list/postQuery';
import { spacing } from '@/styles/designTokens';
import * as schema from '@/sync/db/schema';
import { useLiveQuery } from '@/sync/useLiveQuery';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import pluralizeText from '@/utils/pluralizeText';

/**
 * The asset's details below the photo (useDetailsPanel): its albums and when it was last posted,
 * each opening its album or post, and (with `showsAllPosts`) all its posts in the posts tab. The
 * content, and its live reads, mount only while `isShown`.
 */
export default function AssetDetailsPanel({ asset, navigation, isShown, showsAllPosts, style }) {
  return (
    <Animated.View
      style={style}
      // A prop, not a style: Reanimated's web views drop `pointerEvents` given as a style.
      pointerEvents={isShown ? 'auto' : 'none'}
      aria-hidden={!isShown}
    >
      {isShown && <AssetDetails asset={asset} navigation={navigation} showsAllPosts={showsAllPosts} />}
    </Animated.View>
  );
}

function AssetDetails({ asset, navigation, showsAllPosts }) {
  const { bottom } = useSafeAreaInsets();
  const albums = useAssetAlbums(asset.id);
  const posts = useAssetPosts(asset.id);
  const showAssetPosts = useShowAssetPosts(navigation);

  const sortedAlbums = useMemo(() => [...(albums ?? [])].sort(sortAlbumsByCustomOrder), [albums]);
  const lastPost = posts?.rows[0]?.postedAt ? posts.rows[0] : null;
  const postCount = posts?.count ?? 0;
  const albumRows =
    sortedAlbums.length > 0
      ? sortedAlbums.map((album) => (
          <Row
            key={album.id}
            label={album.name}
            value={pluralizeText('1 Asset', '%{count} Assets', album.assetCount)}
            chevron
            onPress={() => navigation.push('AlbumScreen', { albumId: album.id })}
          />
        ))
      : [<Row key="none" label="Not in an album" />];

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.floatingBarBottom }]}>
      <ScreenSectionHeader title="Albums" />
      <Section>{albumRows}</Section>

      <ScreenSectionHeader title="Posts" />
      <Section>
        {lastPost ? (
          <Row
            label="Last posted"
            value={dateToTimeAgo(lastPost.postedAt)}
            chevron
            onPress={() => navigation.push('PostScreen', { postId: lastPost.id })}
          />
        ) : (
          <Row label="Never posted" />
        )}
        {showsAllPosts && postCount > (lastPost ? 1 : 0) && (
          <Row label="All posts" value={String(postCount)} chevron onPress={() => showAssetPosts(asset.id)} />
        )}
      </Section>
    </ScrollView>
  );
}

// As the album list's stats (useAlbumRows): during a write burst re-read at most about once a second.
const MIN_REREAD_INTERVAL = 1000;

function useAssetAlbums(assetId) {
  const query = assetAlbumsQuery(assetId);
  return useLiveQuery(query.read, query.tables, [assetId], { minInterval: MIN_REREAD_INTERVAL });
}

// The newest post by postedAt (never-posted ones sort last) and how many posts the asset is in.
function useAssetPosts(assetId) {
  const query = postQuery({ scope: { assetId } });
  return useLiveQuery(
    (db) => query.read(db, { limit: 1, withAssets: false }),
    [schema.posts, schema.postAssets],
    [assetId],
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
});
