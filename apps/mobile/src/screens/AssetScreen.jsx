import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetImage from '@/components/AssetImage';
import Page from '@/components/Page';
import VideoControls from '@/components/VideoControls';
import FloatingDetailActionsBar from '@/components/floating-bars/FloatingDetailActionsBar';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import AssetPager from '@/features/asset-detail/AssetPager';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import getAssetPagerState from '@/features/asset-detail/getAssetPagerState';
import useAssets from '@/features/assets-context/useAssets';
import { radii, scale, spacing } from '@/styles/designTokens';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

export default function AssetScreen({ route, navigation }) {
  const { assets, setAssetsDeleted } = useAssets();
  const [selectedAssetId, setSelectedAssetId] = useState(route.params.assetId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  const { visibleAssetIds, currentAssetId } = useMemo(
    () => getAssetPagerState({ assetIds: route.params.assetIds, assets, selectedAssetId }),
    [route.params.assetIds, assets, selectedAssetId],
  );
  const asset = assets[currentAssetId];
  const headerDate = asset ? formatDetailHeaderDate(asset.createdAt) : null;

  const headerTopOffset = insets.top + spacing.contentPaddingTop;

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

      <AssetPager
        assetIds={visibleAssetIds}
        currentAssetId={currentAssetId}
        onChangeAssetId={setSelectedAssetId}
        onTapAsset={() => setIsFullscreen(true)}
      />

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
