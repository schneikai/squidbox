import { useEffect, useState } from 'react';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import GradientPillButton from '@/components/GradientPillButton';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import FloatingSegmentPill from '@/components/floating-bars/FloatingSegmentPill';
import AlbumPicker from '@/features/album-list/AlbumPicker';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import AssetPickerGrid from '@/features/asset-picker/AssetPickerGrid';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import getAlbumAssetScope from '@/utils/albums/getAlbumAssetScope';

const TABS = [
  { key: 'Library', icon: 'grid', label: 'Library' },
  { key: 'Albums', icon: 'library', label: 'Albums' },
];

// The modal of useAssetPicker: pick assets from the library or from an album. The selection holds
// across both, and Add hands the picked assets to the caller.
export default function AssetPickerScreen({ route, navigation }) {
  const { finishAssetPicking } = useAssetPicker();
  const selection = useToggleSelectAssetsAction();
  const [activeTab, setActiveTab] = useState('Library');
  const [album, setAlbum] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const expandProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Closing the picker without Add (the close button, a swipe down) picks nothing.
  useEffect(() => () => finishAssetPicking([]), [finishAssetPicking]);

  const selectedCount = selection.selectedAssetIds.length;
  const isPickingAlbum = activeTab === 'Albums' && !album;
  const title = album?.name ?? activeTab;

  // Each view starts at its top, so the header title shows again.
  function showView(nextTab, nextAlbum) {
    setActiveTab(nextTab);
    setAlbum(nextAlbum);
    scrollY.value = 0;
  }

  // Once only: a second tap while the picker closes would close the screen below it too.
  async function handleAdd() {
    setIsAdding(true);
    finishAssetPicking(await readByIds(getDb(), schema.assets, selection.selectedAssetIds));
    navigation.goBack();
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={
          album ? (
            <IconButton icon="chevron-left" onPress={() => showView('Albums', null)} accessibilityLabel="Albums" />
          ) : (
            <ModalCloseButton onPress={() => navigation.goBack()} />
          )
        }
        centerSlot={title}
        scrollY={scrollY}
        rightSlot={
          <GradientPillButton
            label={selectedCount ? `Add ${selectedCount}` : 'Add'}
            onPress={handleAdd}
            disabled={!selectedCount || isAdding}
          />
        }
      />

      {isPickingAlbum ? (
        <AlbumPicker
          onPick={(pickedAlbum) => showView('Albums', pickedAlbum)}
          paddingTop={MODAL_HEADER_HEIGHT}
          onScroll={onScroll}
          expandProgress={expandProgress}
        />
      ) : (
        <AssetPickerGrid
          // A new grid per album: its own search, sort and filter, and it starts at the top.
          key={album?.id ?? 'library'}
          scope={album ? getAlbumAssetScope(album) : 'library'}
          exclude={route.params?.exclude}
          selection={selection}
          onScroll={onScroll}
          scrollY={scrollY}
          expandProgress={expandProgress}
        />
      )}

      <FloatingSegmentPill
        tabs={TABS}
        activeTab={activeTab}
        onTabPress={(tab) => showView(tab, null)}
        expandProgress={expandProgress}
      />
    </ModalSheet>
  );
}
