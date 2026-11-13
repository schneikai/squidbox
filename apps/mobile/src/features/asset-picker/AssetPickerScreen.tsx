import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SegmentedPill, { type SegmentedPillItem } from '@/components/floating-bars/SegmentedPill';
import useAlbum from '@/features/album-detail/useAlbum';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import AlbumPicker from '@/features/asset-picker/AlbumPicker';
import AssetPickerGrid from '@/features/asset-picker/AssetPickerGrid';
import useScrollY from '@/hooks/useScrollY';
import listParam from '@/lib/listParam';
import useAssetPicker from '@/providers/asset-picker/useAssetPicker';
import { layout } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import type { AlbumRow, AssetRow } from '@/sync/db/schema';
import { readByIds } from '@/sync/readByIds';
import getAlbumAssetScope from '@/utils/albums/getAlbumAssetScope';

type PickerTab = 'Library' | 'Albums';

const TABS: SegmentedPillItem<PickerTab>[] = [
  { key: 'Library', icon: 'grid', label: 'Library' },
  { key: 'Albums', icon: 'library', label: 'Albums' },
];

// The sheet of useAssetPicker (what to leave out: `exclude`, comma-separated ids, or an album's,
// `excludeAlbumId`): pick assets from the library or from an album. The selection holds
// across both, and Add hands the picked assets to the caller.
export default function AssetPickerScreen() {
  const navigation = useNavigation();
  // The params pickerParams (AssetPickerProvider) writes.
  const params = useLocalSearchParams<{ excludeAlbumId?: string; exclude?: string }>();
  const exclude = params.excludeAlbumId ? { albumId: params.excludeAlbumId } : listParam(params.exclude);
  const { finishAssetPicking } = useAssetPicker();
  const selection = useToggleSelectAssetsAction();
  const [activeTab, setActiveTab] = useState<PickerTab>('Library');
  const [pickedAlbum, setPickedAlbum] = useState<AlbumRow | null>(null);
  const liveAlbum = useAlbum(pickedAlbum?.id);
  const [isAdding, setIsAdding] = useState(false);
  const expandProgress = useSharedValue(0);
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  // The switcher slides out while the search bar next to it is open (SearchOptionsBar's progress).
  const switcherStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(expandProgress.value, [0, 1], [0, 30], Extrapolation.CLAMP) }],
    pointerEvents: expandProgress.value > 0.3 ? 'none' : 'auto',
  }));

  // Closing the picker without Add (the close button, a swipe down) picks nothing.
  useEffect(() => () => finishAssetPicking([]), [finishAssetPicking]);

  // An album deleted while it shows (e.g. by a sync) goes back to the albums, as a screen would close.
  useEffect(() => {
    if (!pickedAlbum || liveAlbum !== null) return;
    Alert.alert('This album was deleted');
    showView('Albums', null);
  }, [liveAlbum]);

  // The album as picked until it is read, then live, so a rename shows.
  const album = liveAlbum ?? pickedAlbum;
  const selectedCount = selection.selectedAssetIds.length;
  const isPickingAlbum = activeTab === 'Albums' && !album;
  const title = album?.name ?? activeTab;

  // Each view starts at its top, so drag-select reads the new list's offset.
  function showView(nextTab: PickerTab, nextAlbum: AlbumRow | null) {
    setActiveTab(nextTab);
    setPickedAlbum(nextAlbum);
    scrollY.value = 0;
  }

  // Once only: a second tap while the picker closes would close the screen below it too. So Add
  // turns back on only when the read fails and the picker stays open.
  async function handleAdd() {
    setIsAdding(true);
    let assets: AssetRow[];
    try {
      assets = await readByIds(getDb(), schema.assets, selection.selectedAssetIds);
    } catch {
      setIsAdding(false);
      Alert.alert("Couldn't add the photos", 'Please try again.');
      return;
    }
    finishAssetPicking(assets);
    navigation.goBack();
  }

  return (
    <ModalSheet testID="asset-picker">
      <ModalHeader
        leading={
          album ? (
            <Button icon="chevron-left" onPress={() => showView('Albums', null)} accessibilityLabel="Albums" />
          ) : (
            <Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />
          )
        }
        title={title}
        trailing={
          <Button
            variant="primary"
            label={selectedCount ? `Add ${selectedCount}` : 'Add'}
            onPress={handleAdd}
            disabled={!selectedCount || isAdding}
          />
        }
      />

      {isPickingAlbum ? (
        <AlbumPicker
          onPick={(nextAlbum: AlbumRow) => showView('Albums', nextAlbum)}
          onScroll={onScroll}
          expandProgress={expandProgress}
        />
      ) : (
        <AssetPickerGrid
          // A new grid per album: its own search, sort and filter, and it starts at the top.
          key={album?.id ?? 'library'}
          scope={album ? getAlbumAssetScope(album) : 'library'}
          exclude={exclude}
          selection={selection}
          onScroll={onScroll}
          scrollY={scrollY}
          expandProgress={expandProgress}
        />
      )}

      <Animated.View
        style={[styles.switcher, { bottom: bottom + layout.barMargin }, switcherStyle]}
        pointerEvents="box-none"
      >
        <SegmentedPill items={TABS} activeKey={activeTab} onSelect={(tab) => showView(tab, null)} />
      </Animated.View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  // Bottom right, over the grid.
  switcher: {
    position: 'absolute',
    right: layout.sideGutter,
    zIndex: 100,
  },
});
