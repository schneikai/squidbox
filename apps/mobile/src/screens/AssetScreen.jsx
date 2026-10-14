import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetImage from '@/components/AssetImage';
import Page from '@/components/Page';
import VideoControls from '@/components/VideoControls';
import FloatingDetailActionsBar from '@/components/floating-bars/FloatingDetailActionsBar';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import AssetItem from '@/features/asset-detail/AssetItem';
import AssetPager from '@/features/asset-detail/AssetPager';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import getCurrentAssetId from '@/features/asset-detail/getCurrentAssetId';
import getVisibleAssetIds from '@/features/asset-detail/getVisibleAssetIds';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssets from '@/features/assets-context/useAssets';
import { radii, scale, spacing } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { MEDIA_TYPES } from '@/utils/assets/constants';
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const insets = useSafeAreaInsets();
  // Ids the window found deleted or missing; they stay out as the window moves on, so a remotely
  // deleted asset can't reappear.
  const droppedIds = useRef(new Set());

  useEffect(() => {
    let isCancelled = false;
    assetQuery(query)
      .ids(getDb())
      .then((ids) => {
        if (isCancelled) return;
        // The tapped asset stays, first, if it left the scope between the tap and the snapshot.
        const snapshot = ids.includes(tappedAssetId) ? ids : [tappedAssetId, ...ids];
        setAssetIds(snapshot);
        setCenter(snapshot.indexOf(tappedAssetId));
      });
    return () => {
      isCancelled = true;
    };
  }, [query, tappedAssetId]);

  const snapshot = assetIds ?? [tappedAssetId];
  const windowStart = Math.max(0, center - WINDOW);
  const windowIds = useMemo(() => snapshot.slice(windowStart, center + WINDOW), [snapshot, windowStart, center]);
  // The previous window's rows stay until the new read lands, so a recenter never blanks a page.
  const windowData = useLiveQuery(
    async (db) => ({ ids: windowIds, rows: await readByIds(db, schema.assets, windowIds) }),
    [schema.assets],
    [windowIds],
  );

  const { assetsById, visibleAssetIds } = useMemo(() => {
    const byId = new Map(windowData?.rows.filter((row) => !row.deletedAt).map((row) => [row.id, row]));
    for (const assetId of windowData?.ids ?? []) if (!byId.has(assetId)) droppedIds.current.add(assetId);
    return { assetsById: byId, visibleAssetIds: getVisibleAssetIds(snapshot, droppedIds.current) };
  }, [windowData, snapshot]);
  const currentAssetId = getCurrentAssetId({ assetIds: snapshot, droppedIds: droppedIds.current, selectedAssetId });
  const currentIndex = snapshot.indexOf(currentAssetId);
  const asset = assetsById.get(currentAssetId);
  const headerDate = asset ? formatDetailHeaderDate(asset.createdAt) : null;

  // Recenter once the current asset leaves the middle third of the window.
  useEffect(() => {
    const third = windowIds.length / 3;
    const isInMiddle = currentIndex >= windowStart + third && currentIndex < windowStart + 2 * third;
    if (currentIndex >= 0 && !isInMiddle) setCenter(currentIndex);
  }, [currentIndex, windowStart, windowIds.length]);

  const headerTopOffset = insets.top + spacing.contentPaddingTop;
  const openFullscreen = useCallback(() => setIsFullscreen(true), []);

  if (!windowData) return <Page />;

  return (
    <Page>
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

      {assetIds ? (
        <AssetPager
          assetIds={visibleAssetIds}
          assetsById={assetsById}
          currentAssetId={currentAssetId}
          onChangeAssetId={setSelectedAssetId}
          onTapAsset={openFullscreen}
        />
      ) : (
        <AssetItem asset={asset} style={styles.page} onTap={openFullscreen} />
      )}

      {asset && asset.mediaType === MEDIA_TYPES.VIDEO && <VideoControls asset={asset} />}

      {asset && (
        <FloatingDetailActionsBar
          asset={asset}
          onDeleteAsset={(a) => setAssetsDeleted([a.id])}
          navigation={navigation}
        />
      )}

      {/* Full-screen overlay — tap anywhere to dismiss */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setIsFullscreen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.fullscreenOverlay} onPress={() => setIsFullscreen(false)}>
          <AssetImage asset={asset} contentFit="contain" placeholderColor="transparent" />
        </Pressable>
      </Modal>
    </Page>
  );
}

const NOTE_YELLOW = '#FFF3B0';
const NOTE_YELLOW_BORDER = 'rgba(200,170,0,0.25)';

const styles = StyleSheet.create({
  page: {
    flex: 1,
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
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
});
