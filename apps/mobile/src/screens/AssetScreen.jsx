import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, StatusBar, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import FadeView from '@/components/FadeView';
import IconButton from '@/components/IconButton';
import Page from '@/components/Page';
import FloatingDetailActionsBar from '@/components/floating-bars/FloatingDetailActionsBar';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import AssetItem from '@/features/asset-detail/AssetItem';
import AssetPager from '@/features/asset-detail/AssetPager';
import FullscreenPlayButton from '@/features/asset-detail/FullscreenPlayButton';
import VideoControls from '@/features/asset-detail/VideoControls';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import useDetailsPanel from '@/features/asset-detail/details/useDetailsPanel';
import getCurrentAssetId from '@/features/asset-detail/getCurrentAssetId';
import useAssetVideo from '@/features/asset-detail/useAssetVideo';
import useChromeInsets from '@/features/asset-detail/useChromeInsets';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssets from '@/features/assets-context/useAssets';
import { colors } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

// Rows are read live for a window of ids around the current one: enough pages to swipe through,
// re-read per write, instead of the whole scope.
const WINDOW = 30;

// Opened on a tapped asset with the grid's query (`route.params`: `{ assetId, query }`). The tapped
// asset shows at once, alone; the pager mounts once the query's ids have been read, so it opens on
// that asset without first painting the scope's first one. The snapshot is taken once: an asset
// that stops matching the grid stays in the pager until it is left, only deleted ones drop (from a
// post, which shows trashed assets, only purged ones).
export default function AssetScreen({ route, navigation }) {
  const { setAssetsDeleted } = useAssets();
  const { assetId: tappedAssetId, query } = route.params;
  const scopeQuery = useMemo(() => assetQuery(query), [query]);
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

  const tappedOnly = useMemo(() => [tappedAssetId], [tappedAssetId]);
  const snapshot = assetIds ?? tappedOnly;
  const windowStart = Math.max(0, center - WINDOW);
  const windowIds = useMemo(() => snapshot.slice(windowStart, center + WINDOW), [snapshot, windowStart, center]);
  // The previous window's rows stay until the new read lands, so a recenter never blanks a page.
  const windowData = useLiveQuery(
    async (db) => ({ ids: windowIds, rows: await scopeQuery.rowsByIds(db, windowIds) }),
    [schema.assets],
    [windowIds, query],
  );
  const assetsById = useMemo(() => new Map(windowData?.rows.map((row) => [row.id, row])), [windowData]);
  const currentIndex = snapshot.indexOf(selectedAssetId);
  const asset = assetsById.get(selectedAssetId);
  const headerDate = asset ? formatDetailHeaderDate(asset.createdAt) : null;
  // One player, for the current asset while it is a video, once the pager (which shows it) is up.
  const video = useAssetVideo(assetIds ? asset : null);
  const details = useDetailsPanel();
  const { closeIfOpen, reset: resetDetails } = details;

  // Taken once the tapped asset's row has landed, so the database reads that row first and the asset
  // paints before the whole scope's ids are read.
  const hasWindow = !!windowData;
  useEffect(() => {
    if (!hasWindow) return;
    let isCancelled = false;
    scopeQuery.ids(getDb()).then((ids) => {
      if (isCancelled) return;
      // The tapped asset stays, first, if it left the scope between the tap and the snapshot.
      const ordered = ids.includes(tappedAssetId) ? ids : [tappedAssetId, ...ids];
      setAssetIds(ordered);
      setCenter(ordered.indexOf(tappedAssetId));
    });
    return () => {
      isCancelled = true;
    };
  }, [scopeQuery, tappedAssetId, hasWindow]);

  // Ids the window no longer finds (rowsByIds keeps what the scope keeps: a post's assets until
  // purged, any other scope's until deleted) leave the snapshot for good, so a remotely removed
  // asset can't reappear as the window moves on; the next asset takes over from a dropped current one.
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
  // sheet. Paging while they show keeps them open, showing the next asset's.
  useEffect(() => navigation.addListener('blur', resetDetails), [navigation, resetDetails]);

  // Recenter once the current asset leaves the middle third of the window.
  useEffect(() => {
    const third = windowIds.length / 3;
    const isInMiddle = currentIndex >= windowStart + third && currentIndex < windowStart + 2 * third;
    if (currentIndex >= 0 && !isInMiddle) setCenter(currentIndex);
  }, [currentIndex, windowStart, windowIds.length]);

  // Stays the same, so a tap doesn't re-render every page. While the note is edited a tap ends that
  // (saving it), while the details show it closes them.
  const handleTapAsset = useCallback(() => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
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

      {/* Each page shows its asset's details too (AssetPage); the keyboard lifts them all. */}
      <Animated.View style={[styles.page, details.liftStyle]} onLayout={details.onPageLayout}>
        {assetIds ? (
          <AssetPager
            assetIds={assetIds}
            assetsById={assetsById}
            currentAssetId={selectedAssetId}
            video={video}
            panel={details.panel}
            isDetailsShown={details.isShown}
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
              {/* Opens the details, which only the pager's pages have. */}
              {!!asset.notes && !!assetIds && (
                <View style={styles.noteButton}>
                  <FloatingPill>
                    <IconButton icon="document" onPress={details.open} accessibilityLabel="Show note" />
                  </FloatingPill>
                </View>
              )}
              {video?.player && (
                <VideoControls key={video.key} player={video.player} fallbackDuration={asset.duration} />
              )}
            </FloatingDetailActionsBar>
          )}
        </FadeView>
      </SafeAreaInsetsContext.Provider>
    </Page>
  );
}

const styles = StyleSheet.create({
  // The details panels wait below the screen's edge.
  clip: {
    overflow: 'hidden',
  },
  page: {
    flex: 1,
  },
  fullscreenBackdrop: {
    backgroundColor: colors.background.media,
  },
  // Above the actions, at their left.
  noteButton: {
    alignSelf: 'flex-start',
  },
});
