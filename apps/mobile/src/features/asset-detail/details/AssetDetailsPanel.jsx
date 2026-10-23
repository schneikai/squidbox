import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetNote from './AssetNote';
import useDetailsPanelDrag from './useDetailsPanelDrag';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ThumbnailRow from '@/components/ThumbnailRow';
import { MIN_REREAD_INTERVAL, SCREEN_PADDING } from '@/constants';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import postQuery from '@/features/post-list/postQuery';
import { colors, layout } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatFullDateTime from '@/utils/date-time/formatFullDateTime';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';
import formatVideoDuration from '@/utils/formatVideoDuration';

/**
 * The asset's details below the photo (useDetailsPanel), as Apple Photos' Info: its note, when it
 * was added and its size, the albums it is in and every post it is in (newest first), each opening
 * its album or post. The panel (`style`) clips the details (`contentStyle`, which report
 * `onContentLayout`); a drag anywhere on it moves them along `verticalDrag`'s track
 * (useDetailsPanelDrag, holding `pagerGesture` while it runs). While the note is edited, `onEditingBottomChange(bottom)` says where its
 * field ends within the details (0 once done). Only the current page's (`isCurrent`) stay live and
 * editable; a neighbour's are read once, ready to swipe in. Everything lines up on one inset,
 * SCREEN_PADDING.
 */
export default function AssetDetailsPanel({
  asset,
  isCurrent,
  navigation,
  verticalDrag,
  pagerGesture,
  style,
  contentStyle,
  onContentLayout,
  onEditingBottomChange,
}) {
  const { bottom } = useSafeAreaInsets();
  const { gesture, guardPress } = useDetailsPanelDrag(verticalDrag, pagerGesture);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.panel, style]}>
        <Animated.View
          style={[styles.content, { paddingBottom: bottom + layout.barBottom }, contentStyle]}
          onLayout={onContentLayout}
        >
          <AssetDetails
            asset={asset}
            isCurrent={isCurrent}
            navigation={navigation}
            guardPress={guardPress}
            onEditingBottomChange={onEditingBottomChange}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// Children of the details' view itself, so the note's layout is measured within it.
function AssetDetails({ asset, isCurrent, navigation, guardPress, onEditingBottomChange }) {
  const posts = useAssetPosts(asset.id, isCurrent);

  return (
    <>
      <AssetNote
        key={asset.id}
        asset={asset}
        isEditable={isCurrent}
        guardPress={guardPress}
        onEditingBottomChange={onEditingBottomChange}
      />

      <View style={styles.info}>
        <Text style={listTextStyles.title}>{formatFullDateTime(asset.createdAt)}</Text>
        <Text style={listTextStyles.subtitle}>{infoLine(asset)}</Text>
      </View>

      <ScreenSectionHeader title="Albums" isFlush />
      <AssetAlbums
        assetIds={[asset.id]}
        empty={<Text style={listTextStyles.subtitle}>Not in an album</Text>}
        guardPress={guardPress}
        isLive={isCurrent}
      />

      <ScreenSectionHeader title="Posts" isFlush />
      {posts &&
        (posts.length > 0 ? (
          posts.map((post, index) => (
            <ThumbnailRow
              key={post.id}
              asset={post.postAssets[0]?.asset}
              {...postRowText(post)}
              isLast={index === posts.length - 1}
              onPress={guardPress(() => navigation.push('PostScreen', { postId: post.id }))}
            />
          ))
        ) : (
          <Text style={listTextStyles.subtitle}>Never posted</Text>
        ))}
    </>
  );
}

// A video's length (`duration`, ms), then its size and file size.
function infoLine(asset) {
  const isVideo = asset.mediaType === MEDIA_TYPES.VIDEO && !!asset.duration;
  const size = `${asset.width} × ${asset.height} · ${fileSizeToHumanReadable(asset.fileSize)}`;
  return isVideo ? `${formatVideoDuration(asset.duration)} · ${size}` : size;
}

// The caption over when it was posted; a post without a caption shows only the date.
function postRowText(post) {
  const posted = post.postedAt ? dateToTimeAgo(post.postedAt) : 'Not posted yet';
  const caption = post.text?.trim();
  return caption ? { title: caption, subtitle: posted } : { title: posted };
}

// Every post the asset is in, newest first by postedAt (never-posted ones last), each with its
// first asset for the thumbnail; live while `isLive`.
function useAssetPosts(assetId, isLive) {
  const query = postQuery({ scope: { assetId } });
  return useLiveQuery(
    async (db) => (await query.read(db, { withCount: false, firstAssetOnly: true })).rows,
    query.tables,
    [assetId],
    { minInterval: MIN_REREAD_INTERVAL, isLive },
  );
}

const styles = StyleSheet.create({
  // Opaque: the photo, grown to cover the band above the panel, reaches in behind it.
  panel: {
    overflow: 'hidden',
    backgroundColor: colors.background.surface,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
  },
  info: {
    marginTop: SCREEN_PADDING,
  },
});
