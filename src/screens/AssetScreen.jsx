import { useState, useEffect, useRef } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Page from '@/components/Page';

import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingDetailActionsBar from '@/components/floating-bars/FloatingDetailActionsBar';
import VideoControls from '@/components/VideoControls';
import AssetItem from '@/features/asset-detail/AssetItem';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import useAssets from '@/features/assets-context/useAssets';
import { SCREEN_PADDING } from '@/constants';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import dateToSimpleFormat from '@/utils/date-time/dateToSimpleFormat';
import { spacing } from '@/styles/designTokens';

export default function AssetScreen({ route, navigation }) {
  const { assets, setAssetsDeleted } = useAssets();
  const [asset, setAsset] = useState(assets[route.params.assetId]);
  const [assetIds, setAssetIds] = useState(route.params.assetIds);
  const insets = useSafeAreaInsets();

  const window = useWindowDimensions();
  const windowWidth = window.width;
  const initialScrollIndex = assetIds.findIndex((x) => x === route.params.assetId);

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
    setAsset(assets[assetId]);
  });

  const headerTopOffset = insets.top + spacing.contentPaddingTop;

  return (
    <Page>
      <FloatingDetailHeader
        title={asset ? dateToSimpleFormat(asset.createdAt) : ''}
        onBack={() => navigation.goBack()}
        menuSlot={
          <MoreAction asset={asset} navigation={navigation} />
        }
      />

      {!!asset?.notes && (
        <TouchableOpacity
          style={[styles.notesContainer, { marginTop: headerTopOffset }]}
          onPress={() => navigation.navigate('EditNotesModal', { type: 'asset', id: asset.id, notes: asset.notes })}
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
          return <AssetItem asset={a} style={{ width: windowWidth }} />;
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
    </Page>
  );
}

const styles = StyleSheet.create({
  notesContainer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
