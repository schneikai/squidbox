import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getDb } from '@/sync/db/client';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

// Opened on a tapped asset with the grid's query (`route.params`: `{ assetId, query }`). The tapped
// asset shows at once, alone; the pager mounts once the query's ids have been read, so it opens on
// that asset without first painting the scope's first one. The snapshot is taken once: an asset
// that stops matching the grid stays in the pager until it is left, only deleted ones drop.
export default function AssetScreen({ route, navigation }) {
  const { assets, setAssetsDeleted } = useAssets();
  const { assetId: tappedAssetId, query } = route.params;
  const [selectedAssetId, setSelectedAssetId] = useState(tappedAssetId);
  const [assetIds, setAssetIds] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let isCancelled = false;
    assetQuery(query)
      .ids(getDb())
      .then((ids) => {
        // The tapped asset stays, first, if it left the scope between the tap and the snapshot.
        if (!isCancelled) setAssetIds(ids.includes(tappedAssetId) ? ids : [tappedAssetId, ...ids]);
      });
    return () => {
      isCancelled = true;
    };
  }, [query, tappedAssetId]);

  const snapshot = assetIds ?? [tappedAssetId];
  // Separate so a swipe (a new selectedAssetId) doesn't refilter every asset.
  const visibleAssetIds = useMemo(() => getVisibleAssetIds(snapshot, assets), [snapshot, assets]);
  const currentAssetId = getCurrentAssetId({ assetIds: snapshot, assets, selectedAssetId });
  const asset = assets[currentAssetId];
  const headerDate = asset ? formatDetailHeaderDate(asset.createdAt) : null;

  const headerTopOffset = insets.top + spacing.contentPaddingTop;
  const openFullscreen = useCallback(() => setIsFullscreen(true), []);

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
