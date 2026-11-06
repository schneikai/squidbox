import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetNote from './AssetNote';
import type { DetailsPanel, VerticalDrag } from './useDetailsPanel';
import useDetailsPanelDrag from './useDetailsPanelDrag';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import TargetContactsSection from '@/features/contact-links/TargetContactsSection';
import PhotoTagsSection from '@/features/photo-tags/PhotoTagsSection';
import PostRows from '@/features/post-list/PostRows';
import type { GuardPress } from '@/lib/unguarded';
import { colors, layout, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import type { AssetRow } from '@/sync/db/schema';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import formatFullDateTime from '@/utils/date-time/formatFullDateTime';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';
import formatVideoDuration from '@/utils/formatVideoDuration';

type AssetDetailsPanelProps = {
  asset: AssetRow;
  isCurrent: boolean;
  verticalDrag: VerticalDrag;
  pagerGesture: DetailsPanel['pagerGesture'];
  style: AnimatedProps<ViewProps>['style'];
  contentStyle?: AnimatedProps<ViewProps>['style'];
  onContentLayout: (event: LayoutChangeEvent) => void;
  onEditingBottomChange: DetailsPanel['setEditingBottom'];
};

/**
 * The asset's details below the photo (useDetailsPanel), as Apple Photos' Info: its note, the tags
 * the assistant sees in it (while the Assistant is available), the contacts on it, when it was added and its size, the
 * albums it is in and the posts it is in (PostRows), each opening its album or post. The panel
 * (`style`) clips the details (`contentStyle`, which report `onContentLayout`); a drag anywhere on
 * it moves them along `verticalDrag`'s track (useDetailsPanelDrag, holding `pagerGesture` while it
 * runs). While the note is edited, `onEditingBottomChange(bottom)` says where its field ends within
 * the details (0 once done). Only the current page's (`isCurrent`) stay live and editable; a
 * neighbour's are read once, ready to swipe in. Everything lines up on the screen's gutter.
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
}: AssetDetailsPanelProps) {
  const { bottom } = useSafeAreaInsets();
  const { gesture, guardPress } = useDetailsPanelDrag(verticalDrag, pagerGesture);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.panel, style]}>
        <Animated.View
          style={[styles.content, { paddingBottom: bottom + layout.barMargin }, contentStyle]}
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

type AssetDetailsProps = Pick<AssetDetailsPanelProps, 'asset' | 'isCurrent' | 'onEditingBottomChange'> & {
  guardPress: GuardPress;
};

// Children of the details' view itself, so the note's layout is measured within it.
function AssetDetails({ asset, isCurrent, guardPress, onEditingBottomChange }: AssetDetailsProps) {
  return (
    <>
      <AssetNote
        key={asset.id}
        asset={asset}
        isEditable={isCurrent}
        guardPress={guardPress}
        onEditingBottomChange={onEditingBottomChange}
      />

      <View style={styles.tags}>
        <PhotoTagsSection asset={asset} guardPress={guardPress} />
      </View>

      <TargetContactsSection
        targetType="asset"
        targetId={asset.id}
        guardPress={guardPress}
        isLive={isCurrent}
        isFlush
      />

      <View style={styles.info}>
        <Text style={listTextStyles.title}>{formatFullDateTime(asset.createdAt)}</Text>
        <Text style={listTextStyles.subtitle}>{infoLine(asset)}</Text>
      </View>

      <ScreenSectionHeader title="Albums" isFlush />
      <AssetAlbums
        scope={{ assetIds: [asset.id] }}
        emptyText="Not in an album"
        guardPress={guardPress}
        isLive={isCurrent}
      />

      <ScreenSectionHeader title="Posts" isFlush />
      <PostRows scope={{ assetId: asset.id }} emptyText="Never posted" guardPress={guardPress} isLive={isCurrent} />
    </>
  );
}

// A video's length (`duration`, ms), then its size and file size.
function infoLine(asset: Pick<AssetRow, 'mediaType' | 'duration' | 'width' | 'height' | 'fileSize'>) {
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
    paddingTop: space.lg,
    paddingHorizontal: layout.sideGutter,
  },
  // The panel's blocks are apart as a screen's sections are.
  tags: {
    marginTop: layout.sectionGap,
  },
  info: {
    marginTop: layout.sectionGap,
  },
});
