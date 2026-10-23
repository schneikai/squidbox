import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import GradientPillButton from '@/components/GradientPillButton';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import FloatingSegmentPill from '@/components/floating-bars/FloatingSegmentPill';
import useAlbum from '@/features/album-detail/useAlbum';
import AlbumPicker from '@/features/album-list/AlbumPicker';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import AssetPickerGrid from '@/features/asset-picker/AssetPickerGrid';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useScrollY from '@/hooks/useScrollY';
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
  const [pickedAlbum, setPickedAlbum] = useState(null);
  const liveAlbum = useAlbum(pickedAlbum?.id);
  const [isAdding, setIsAdding] = useState(false);
  const expandProgress = useSharedValue(0);
  const { scrollY, onScroll } = useScrollY();

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

  // Each view starts at its top, so the header title shows again.
  function showView(nextTab, nextAlbum) {
    setActiveTab(nextTab);
    setPickedAlbum(nextAlbum);
    scrollY.value = 0;
  }

  // Once only: a second tap while the picker closes would close the screen below it too. So Add
  // turns back on only when the read fails and the picker stays open.
  async function handleAdd() {
    setIsAdding(true);
    let assets;
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
          onPick={(nextAlbum) => showView('Albums', nextAlbum)}
          showSmartAlbums
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
