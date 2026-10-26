import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetNote from './AssetNote';
import useDetailsPanelDrag from './useDetailsPanelDrag';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { SCREEN_PADDING } from '@/constants';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import PhotoTagsSection from '@/features/photo-tags/PhotoTagsSection';
import PostRows from '@/features/post-list/PostRows';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import { colors, layout } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import formatFullDateTime from '@/utils/date-time/formatFullDateTime';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';
import formatVideoDuration from '@/utils/formatVideoDuration';

/**
 * The asset's details below the photo (useDetailsPanel), as Apple Photos' Info: its note, the tags
 * the assistant sees in it (while the Assistant is available), when it was added and its size, the
 * albums it is in and the posts it is in (PostRows), each opening its album or post. The panel
 * (`style`) clips the details (`contentStyle`, which report `onContentLayout`); a drag anywhere on
 * it moves them along `verticalDrag`'s track (useDetailsPanelDrag, holding `pagerGesture` while it
 * runs). While the note is edited, `onEditingBottomChange(bottom)` says where its field ends within
 * the details (0 once done). Only the current page's (`isCurrent`) stay live and editable; a
 * neighbour's are read once, ready to swipe in. Everything lines up on one inset, SCREEN_PADDING.
 */
export default function AssetDetailsPanel({
  asset,
  isCurrent,
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
            guardPress={guardPress}
            onEditingBottomChange={onEditingBottomChange}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// Children of the details' view itself, so the note's layout is measured within it.
function AssetDetails({ asset, isCurrent, guardPress, onEditingBottomChange }) {
  const isAssistantAvailable = useIsAssistantAvailable();
  return (
    <>
      <AssetNote
        key={asset.id}
        asset={asset}
        isEditable={isCurrent}
        guardPress={guardPress}
        onEditingBottomChange={onEditingBottomChange}
      />

      {isAssistantAvailable && (
        <View style={styles.tags}>
          <PhotoTagsSection asset={asset} guardPress={guardPress} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={listTextStyles.title}>{formatFullDateTime(asset.createdAt)}</Text>
        <Text style={listTextStyles.subtitle}>{infoLine(asset)}</Text>
      </View>

      <ScreenSectionHeader title="Albums" isFlush />
      <AssetAlbums assetIds={[asset.id]} emptyText="Not in an album" guardPress={guardPress} isLive={isCurrent} />

      <ScreenSectionHeader title="Posts" isFlush />
      <PostRows scope={{ assetId: asset.id }} emptyText="Never posted" guardPress={guardPress} isLive={isCurrent} />
    </>
  );
}

// A video's length (`duration`, ms), then its size and file size.
function infoLine(asset) {
  const isVideo = asset.mediaType === MEDIA_TYPES.VIDEO && !!asset.duration;
  const size = `${asset.width} × ${asset.height} · ${fileSizeToHumanReadable(asset.fileSize)}`;
  return isVideo ? `${formatVideoDuration(asset.duration)} · ${size}` : size;
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
  tags: {
    marginTop: SCREEN_PADDING,
  },
  info: {
    marginTop: SCREEN_PADDING,
  },
});
