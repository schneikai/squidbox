import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import FadeView from '@/components/FadeView';
import Page from '@/components/Page';
import FloatingDetailActionsBar from '@/components/floating-bars/FloatingDetailActionsBar';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import AssetItem from '@/features/asset-detail/AssetItem';
import AssetPager from '@/features/asset-detail/AssetPager';
import FullscreenPlayButton from '@/features/asset-detail/FullscreenPlayButton';
import VideoControls from '@/features/asset-detail/VideoControls';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import AssetDetailsPanel from '@/features/asset-detail/details/AssetDetailsPanel';
import useDetailsPanel from '@/features/asset-detail/details/useDetailsPanel';
import getCurrentAssetId from '@/features/asset-detail/getCurrentAssetId';
import useAssetVideo from '@/features/asset-detail/useAssetVideo';
import useChromeInsets from '@/features/asset-detail/useChromeInsets';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssets from '@/features/assets-context/useAssets';
import { radii, scale, spacing } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

// Rows are read live for a window of ids around the current one: enough pages to swipe through,
// re-read per write, instead of the whole scope.
const WINDOW = 30;

// Opened on a tapped asset with the grid's query (`route.params`: `{ assetId, query }`). The tapped
// asset shows at once, alone; the pager mounts once the query's ids have been read, so it opens on
// that asset without first painting the scope's first one. The snapshot is taken once: an asset
// that stops matching the grid stays in the pager until it is left, only deleted ones drop.
export default function AssetScreen({ route, navigation }) {
  const { setAssetsDeleted } = useAssets();
  const { assetId: tappedAssetId, query } = route.params;
  const [selectedAssetId, setSelectedAssetId] = useState(tappedAssetId);
  const [assetIds, setAssetIds] = useState(null);
  const [center, setCenter] = useState(0);
  const [isPagerLocked, setIsPagerLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // In the create-post sheet (a page sheet, inside CreatePostNavigator) the status bar stays: hiding
  // it can resize the sheet.
  const isInSheet = !!navigation.getParent();
  const isStatusBarHidden = isFullscreen && !isInSheet;
  const chromeInsets = useChromeInsets(isStatusBarHidden);
  const headerTopOffset = chromeInsets.top + spacing.contentPaddingTop;

  const tappedOnly = useMemo(() => [tappedAssetId], [tappedAssetId]);
  const snapshot = assetIds ?? tappedOnly;
  const windowStart = Math.max(0, center - WINDOW);
  const windowIds = useMemo(() => snapshot.slice(windowStart, center + WINDOW), [snapshot, windowStart, center]);
  // The previous window's rows stay until the new read lands, so a recenter never blanks a page.
  const windowData = useLiveQuery(
    async (db) => ({ ids: windowIds, rows: await readByIds(db, schema.assets, windowIds) }),
    [schema.assets],
    [windowIds],
  );
  const assetsById = useMemo(
    () => new Map(windowData?.rows.filter((row) => !row.deletedAt).map((row) => [row.id, row])),
    [windowData],
  );
  const currentIndex = snapshot.indexOf(selectedAssetId);
  const asset = assetsById.get(selectedAssetId);
  const headerDate = asset ? formatDetailHeaderDate(asset.createdAt) : null;
  // One player, for the current asset while it is a video, once the pager (which shows it) is up.
  const video = useAssetVideo(assetIds ? asset : null);
  const details = useDetailsPanel({ aspectRatio: asset?.width / asset?.height, headerBottom: headerTopOffset });
  const { closeIfOpen, reset: resetDetails } = details;

  // Taken once the tapped asset's row has landed, so the database reads that row first and the asset
  // paints before the whole scope's ids are read.
  const hasWindow = !!windowData;
  useEffect(() => {
    if (!hasWindow) return;
    let isCancelled = false;
    assetQuery(query)
      .ids(getDb())
      .then((ids) => {
        if (isCancelled) return;
        // The tapped asset stays, first, if it left the scope between the tap and the snapshot.
        const ordered = ids.includes(tappedAssetId) ? ids : [tappedAssetId, ...ids];
        setAssetIds(ordered);
        setCenter(ordered.indexOf(tappedAssetId));
      });
    return () => {
      isCancelled = true;
    };
  }, [query, tappedAssetId, hasWindow]);

  // Ids the window finds deleted or missing leave the snapshot for good, so a remotely deleted asset
  // can't reappear as the window moves on; the next asset takes over from a dropped current one.
  useEffect(() => {
    if (!assetIds || !windowData) return;
    const droppedIds = new Set(windowData.ids.filter((assetId) => !assetsById.has(assetId)));
    if (droppedIds.size === 0) return;
    setSelectedAssetId(getCurrentAssetId({ assetIds, droppedIds, selectedAssetId }));
    setAssetIds(assetIds.filter((assetId) => !droppedIds.has(assetId)));
  }, [windowData]);

  // A zoomed photo's pan owns the swipe, so the swipe back is locked with the pager, and so is the
  // swipe down that dismisses the sheet this screen may be in (CreatePostNavigator): a native-stack
  // modal can't be swiped away without `gestureEnabled`. While the details show, a swipe down closes
  // them, so the sheet's swipe is locked then too. The sheet's swipe comes back on unmount.
  const isSheetLocked = isPagerLocked || details.isShown;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isPagerLocked });
  }, [navigation, isPagerLocked]);
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ gestureEnabled: !isSheetLocked });
    if (!isSheetLocked) return;
    return () => parent?.setOptions({ gestureEnabled: true });
  }, [navigation, isSheetLocked]);

  // The details leave fullscreen as they start to show.
  useEffect(() => {
    if (details.isShown) setIsFullscreen(false);
  }, [details.isShown]);

  // The details close when the screen is left (a row opened an album or a post), releasing the
  // sheet, and when the asset they show changes, which only a deletion does: paging is locked while
  // they show.
  useEffect(() => navigation.addListener('blur', resetDetails), [navigation, resetDetails]);
  const shownAssetId = asset?.id;
  useEffect(() => {
    resetDetails();
  }, [shownAssetId, resetDetails]);

  // Recenter once the current asset leaves the middle third of the window.
  useEffect(() => {
    const third = windowIds.length / 3;
    const isInMiddle = currentIndex >= windowStart + third && currentIndex < windowStart + 2 * third;
    if (currentIndex >= 0 && !isInMiddle) setCenter(currentIndex);
  }, [currentIndex, windowStart, windowIds.length]);

  // Stays the same, so a tap doesn't re-render every page. While the details show, a tap closes them.
  const handleTapAsset = useCallback(() => {
    if (!closeIfOpen()) setIsFullscreen((isOn) => !isOn);
  }, [closeIfOpen]);

  if (!windowData) return <Page />;

  return (
    <Page style={styles.clip}>
      <StatusBar hidden={isStatusBarHidden} animated showHideTransition="fade" />
      <FadeView
        isVisible={isFullscreen}
        style={[StyleSheet.absoluteFill, styles.fullscreenBackdrop]}
        pointerEvents="none"
      />

      <Animated.View style={[styles.page, details.mediaStyle]} onLayout={details.onMediaLayout}>
        {assetIds ? (
          <AssetPager
            assetIds={assetIds}
            assetsById={assetsById}
            currentAssetId={selectedAssetId}
            video={video}
            verticalDrag={details.verticalDrag}
            isPagingLocked={details.isShown}
            onChangeAssetId={setSelectedAssetId}
            onTapAsset={handleTapAsset}
            onLockChange={setIsPagerLocked}
          />
        ) : (
          // Not zoomable (nor its details shown) until the pager takes over, which locks the swipes
          // while zoomed.
          <AssetItem asset={asset} style={styles.page} onTap={handleTapAsset} />
        )}
      </Animated.View>

      {video?.player && <FullscreenPlayButton key={video.key} player={video.player} isVisible={isFullscreen} />}

      <SafeAreaInsetsContext.Provider value={chromeInsets}>
        <FadeView isVisible={!isFullscreen} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <FloatingDetailHeader
            title={headerDate?.title ?? ''}
            subtitle={headerDate?.subtitle ?? ''}
            onBack={() => navigation.goBack()}
            menuSlot={asset && <MoreAction asset={asset} navigation={navigation} />}
          />

          {!!asset?.notes && (
            <TouchableOpacity
              style={[styles.notesContainer, { top: headerTopOffset }]}
              onPress={() => navigation.navigate('EditNotesModal', { type: 'asset', id: asset.id, notes: asset.notes })}
              activeOpacity={0.85}
            >
              <Text style={styles.notesText}>{asset.notes}</Text>
            </TouchableOpacity>
          )}
        </FadeView>

        {/* The details panel takes the actions' place. */}
        <FadeView
          isVisible={!isFullscreen && !details.isShown}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          {asset && (
            <FloatingDetailActionsBar
              asset={asset}
              onDeleteAsset={(a) => setAssetsDeleted([a.id])}
              navigation={navigation}
            >
              {video?.player && (
                <VideoControls key={video.key} player={video.player} fallbackDuration={asset.duration} />
              )}
            </FloatingDetailActionsBar>
          )}
        </FadeView>
      </SafeAreaInsetsContext.Provider>

      {assetIds && asset && (
        <AssetDetailsPanel
          asset={asset}
          navigation={navigation}
          isShown={details.isShown}
          showsAllPosts={!isInSheet}
          style={[styles.detailsPanel, details.panelStyle]}
        />
      )}
    </Page>
  );
}

const NOTE_YELLOW = '#FFF3B0';
const NOTE_YELLOW_BORDER = 'rgba(200,170,0,0.25)';

const styles = StyleSheet.create({
  // The details panel waits below the screen's edge.
  clip: {
    overflow: 'hidden',
  },
  page: {
    flex: 1,
  },
  detailsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullscreenBackdrop: {
    backgroundColor: '#000',
  },
  notesContainer: {
    position: 'absolute',
    left: spacing.floatingBarSide,
    right: spacing.floatingBarSide,
    zIndex: 10,
    backgroundColor: NOTE_YELLOW,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: NOTE_YELLOW_BORDER,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 10,
  },
  notesText: {
    fontSize: scale(14),
    color: '#5C4A00',
    lineHeight: 20,
  },
});
