import moment from 'moment';
import { useState, useEffect, useRef } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetImage from '@/components/AssetImage';
import Page from '@/components/Page';
import VideoControls from '@/components/VideoControls';
import FloatingDetailActionsBar from '@/components/floating-bars/FloatingDetailActionsBar';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import AssetItem from '@/features/asset-detail/AssetItem';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import useAssets from '@/features/assets-context/useAssets';
import { colors, radii, scale, spacing } from '@/styles/designTokens';
import { MEDIA_TYPES } from '@/utils/assets/constants';

export default function AssetScreen({ route, navigation }) {
  const { assets, setAssetsDeleted } = useAssets();
  const [asset, setAsset] = useState(assets[route.params.assetId]);
  const [assetIds, setAssetIds] = useState(route.params.assetIds);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  const window = useWindowDimensions();
  const windowWidth = window.width;
  const initialScrollIndex = assetIds.findIndex((x) => x === route.params.assetId);

  // Keep the latest assets available to the viewability callback below, which is
  // created once and would otherwise capture a stale assets map (showing the
  // wrong favorite state when paging between assets).
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  useEffect(() => {
    let updatedAsset = assets[asset.id];

    if (updatedAsset.isDeleted) {
      const assetIndex = assetIds.findIndex((x) => x === asset.id);
      const newAssetId = assetIds[assetIndex + 1] || assetIds[assetIndex - 1];
      setAssetIds((prev) => prev.filter((x) => x !== asset.id));
      updatedAsset = assets[newAssetId];
    }

    setAsset(updatedAsset);
  }, [assets]);

  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    const assetId = viewableItems && viewableItems.length > 0 && viewableItems[0].item;
    if (!assetId) return;
    setAsset(assetsRef.current[assetId]);
  });

  const headerTopOffset = insets.top + spacing.contentPaddingTop;

  return (
    <Page>
      <FloatingDetailHeader
        title={
          asset
            ? moment(asset.createdAt).calendar(null, {
                lastWeek: 'dddd',
                lastDay: '[Yesterday]',
                sameDay: '[Today]',
                sameElse: 'DD. MMM YYYY',
              })
            : ''
        }
        subtitle={asset ? moment(asset.createdAt).format('LT') : ''}
        onBack={() => navigation.goBack()}
        menuSlot={<MoreAction asset={asset} navigation={navigation} />}
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

      <FlatList
        data={assetIds}
        keyExtractor={(assetId) => assetId}
        renderItem={({ item: assetId }) => {
          const a = assets[assetId];
          if (!a) return null;
          return <AssetItem asset={a} style={{ width: windowWidth }} onTap={() => setIsFullscreen(true)} />;
        }}
        getItemLayout={(data, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
        initialScrollIndex={initialScrollIndex}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 90 }}
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
