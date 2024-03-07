import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import AssetImage from '@/components/AssetImage';
import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import useGetAlbumThumbnailAssetAndAssetCount from '@/features/album-list/useGetAlbumThumbnailAssetAndAssetCount';
import useAlbums from '@/features/albums-context/useAlbums';
import popupMenuStyles from '@/styles/popupMenuStyles';
import getTimestamp from '@/utils/date-time/getTimestamp';
import toTimestamp from '@/utils/date-time/toTimestamp';

export default function PostableAlbum({ album, size }) {
  const getAlbumThumbnailAssetAndAssetCount = useGetAlbumThumbnailAssetAndAssetCount();
  const [thumbnailAsset, setThumbnailAsset] = useState(null);
  const navigation = useNavigation();
  const { updateAlbum } = useAlbums();

  useEffect(() => {
    const { thumbnailAsset } = getAlbumThumbnailAssetAndAssetCount(album);
    setThumbnailAsset(thumbnailAsset);
  }, [album]);

  async function handleArchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: getTimestamp() });
  }

  async function handleSuggestAgainLater() {
    const after = toTimestamp({ months: 1 });
    await updateAlbum(album.id, { showInPostSuggestionsAfter: getTimestamp() + after });
  }

  async function handlePress() {
    navigation.navigate('PostAlbumStack', {
      screen: 'AlbumScreen',
      params: { albumId: album.id },
    });
  }

  if (!thumbnailAsset) return null;

  return (
    <TouchableOpacity onPress={handlePress}>
      <View>
        <Text style={styles.postableType}>Album</Text>
        <View style={[styles.imageContainer, { height: size }]}>
          <AssetImage asset={thumbnailAsset} />
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.albumName}>{album.name}</Text>
            <Text style={styles.albumLastPosted}>Never Posted</Text>
          </View>

          <Menu>
            <MenuTrigger customStyles={{ triggerWrapper: styles.actionButton }}>
              <Ionicons name="ellipsis-vertical" style={styles.actionButtonText} />
            </MenuTrigger>
            <MenuOptions customStyles={popupMenuStyles.menuOptions}>
              <TextMenuOption label="Suggest again later" onPress={handleSuggestAgainLater} />
              <TextMenuOption label="Archive" onPress={handleArchiveAlbum} isLast />
            </MenuOptions>
          </Menu>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  actionButton: {
    padding: 5,
    backgroundColor: '#A9A9A9',
  },
  actionButtonText: {
    fontSize: 20,
  },
  imageContainer: {
    flex: 1,
  },
  postableType: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'lightgreen',
    paddingHorizontal: 3,
    paddingVertical: 1,
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '800',
    zIndex: 1,
  },
  albumName: {
    marginTop: 5,
    fontWeight: 'bold',
  },
  albumLastPosted: {
    color: 'gray',
    fontSize: 12,
  },
});
