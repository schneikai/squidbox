import { useNavigation } from '@react-navigation/native';
import { useState, useMemo } from 'react';
import { Text, StyleSheet, View, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from './ScreenHeader';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import HeaderActions from '@/components/HeaderActions';
import SuperPressable from '@/components/SuperPressable';
import AddToAlbumSelectionMenuOption from '@/components/selected-assets-tool-bar/actions/add-to-album-selection-menu-option/AddToAlbumSelectionMenuOption';
import CreatePostSelectionMenuOption from '@/components/selected-assets-tool-bar/actions/create-post-selection-menu-option/CreatePostSelectionMenuOption';
import DeleteFromAlbumSelectionMenuOption from '@/components/selected-assets-tool-bar/actions/delete-from-album-selection-menu-option/DeleteFromAlbumSelectionMenuOption';
import DownloadSelectionMenuOption from '@/components/selected-assets-tool-bar/actions/download-selection-menu-option/DownloadSelectionMenuOption';
import AddAssetAction from '@/features/album-detail/actions/AddAssetAction';
import MoreAction from '@/features/album-detail/actions/MoreAction';
import AssetList from '@/features/asset-list/AssetList';
import SelectionActionsMenu from '@/features/asset-list/actions/selection-actions-menu/SelectionActionsMenu';
import AssetListItem from '@/features/asset-list/AssetListItem';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import ToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/ToggleSelectAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import usePosts from '@/features/posts-context/usePosts';
import preparePosts from '@/features/post-list/preparePosts';

// Assets Tab Component
function AssetsTab({ album, assetIds, isSelectMode, selectedAssetIds, onPressAsset, toggleFavoriteAsset, openAssetQuickView, closeAssetQuickView, sortOrder, listRef }) {
  return (
    <AssetList
      listRef={listRef}
      assetIds={assetIds}
      renderListItem={(asset) => (
        <SuperPressable
          onPress={() => onPressAsset(asset)}
          onDoublePress={() => toggleFavoriteAsset(asset)}
          onLongPress={() => openAssetQuickView(asset)}
          onLongPressOut={() => closeAssetQuickView()}
          style={{ flex: 1 }}
        >
          <AssetListItem
            asset={asset}
            isSelected={selectedAssetIds.includes(asset.id)}
            showLastPostedAt={sortOrder.includes('lastPostedAt')}
          />
        </SuperPressable>
      )}
    />
  );
}

// Posts Tab Component
function PostsTab({ album, navigation }) {
  const { posts } = usePosts();

  const postIds = useMemo(
    () =>
      preparePosts({
        posts: Object.values(posts),
        albums: { [album.id]: album },
        searchText: `album:${album.id}`,
        sortFn: (a, b) => b.postedAt - a.postedAt,
      }).map((post) => post.id),
    [posts, album],
  );

  return (
    <PostList
      postIds={postIds}
      renderListItem={(post) => (
        <SuperPressable
          onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
          style={{ flex: 1 }}
        >
          <PostListItem {...post} />
        </SuperPressable>
      )}
    />
  );
}

export default function Album({ album }) {
  const { assets, toggleFavoriteAsset } = useAssets();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { listRef, listScrollTop } = useAssetList();
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset } = useToggleSelectAssetsAction();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();
  const [activeTab, setActiveTab] = useState('Assets');

  const assetIds = useMemo(
    () =>
      prepareAssets({
        assets: getAlbumAssets(album, assets),
        sortFn: sortFunction,
        filterFn: matchFilter,
      }).map((asset) => asset.id),
    [album, assets, sortFunction, matchFilter],
  );

  function onPressAsset(asset) {
    if (isSelectMode) {
      toggleSelectAsset(asset.id);
    } else {
      navigation.navigate('AlbumAssetScreen', { assetId: asset.id, assetIds });
    }
  }

  function handleBackPress() {
    navigation.goBack();
  }

  return (
    <>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      
      {/* Header section */}
      <View>
        <ScreenHeader album={album} numberOfAssets={assetIds?.length} onPressBack={handleBackPress} insets={insets}>
          <HeaderActions>
            {isSelectMode ? (
              <>
                <ToggleSelectAssetsAction isSelectMode={isSelectMode} onPress={toggleSelectMode} />
                <SelectionActionsMenu selectedAssetIds={selectedAssetIds} allAssetIds={assetIds}>
                  <DownloadSelectionMenuOption />
                  <AddToAlbumSelectionMenuOption />
                  <CreatePostSelectionMenuOption />
                  {!isSmartAlbum(album) && (
                    <DeleteFromAlbumSelectionMenuOption album={album} afterAction={() => toggleSelectMode()} />
                  )}
                </SelectionActionsMenu>
              </>
            ) : (
              <>
                {!isSmartAlbum(album) && <AddAssetAction album={album} />}
                <ToggleSelectAssetsAction isSelectMode={isSelectMode} onPress={toggleSelectMode} />
                <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
                <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
                {!isSmartAlbum(album) && <MoreAction album={album} afterDelete={handleBackPress} />}
              </>
            )}
          </HeaderActions>
        </ScreenHeader>
        {!!album.archivedAt && (
          <View style={styles.flagContainer}>
            <Text style={styles.albumIsArchived}>Archived</Text>
          </View>
        )}
        {!!album.notes && (
          <TouchableOpacity
            style={styles.notesContainer}
            onPress={() => navigation.navigate('EditNotesModal', { type: 'album', id: album.id, notes: album.notes })}
          >
            <Text style={styles.notesText}>{album.notes}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Simple Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable 
          style={[styles.tab, activeTab === 'Assets' && styles.activeTab]} 
          onPress={() => setActiveTab('Assets')}
        >
          <Text style={[styles.tabText, activeTab === 'Assets' && styles.activeTabText]}>
            Assets
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'Posts' && styles.activeTab]} 
          onPress={() => setActiveTab('Posts')}
        >
          <Text style={[styles.tabText, activeTab === 'Posts' && styles.activeTabText]}>
            Posts
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'Assets' ? (
          <AssetsTab
            album={album}
            assetIds={assetIds}
            isSelectMode={isSelectMode}
            selectedAssetIds={selectedAssetIds}
            onPressAsset={onPressAsset}
            toggleFavoriteAsset={toggleFavoriteAsset}
            openAssetQuickView={openAssetQuickView}
            closeAssetQuickView={closeAssetQuickView}
            sortOrder={sortOrder}
            listRef={listRef}
          />
        ) : (
          <PostsTab album={album} navigation={navigation} />
        )}
      </View>

    </>
  );
}

const styles = StyleSheet.create({
  flagContainer: {
    alignSelf: 'left',
    padding: 10,
    marginTop: -10,
  },
  albumIsArchived: {
    backgroundColor: 'pink',
    padding: 4,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '800',
    zIndex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#000',
  },
  tabContent: {
    flex: 1,
  },
  notesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
