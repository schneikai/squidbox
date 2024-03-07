import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import AssetImage from '@/components/AssetImage';
import useGetAlbumThumbnailAssetAndAssetCount from '@/features/album-list/useGetAlbumThumbnailAssetAndAssetCount';

export default function PostAlbum({ album, size }) {
  const getAlbumThumbnailAssetAndAssetCount = useGetAlbumThumbnailAssetAndAssetCount();
  const [thumbnailAsset, setThumbnailAsset] = useState(null);
  const [numberOfAssets, setNumberOfAssets] = useState(0);
  const navigation = useNavigation();

  useEffect(() => {
    const { thumbnailAsset, numberOfAssets } = getAlbumThumbnailAssetAndAssetCount(album);
    setThumbnailAsset(thumbnailAsset);
    setNumberOfAssets(numberOfAssets);
  }, [album]);

  async function handlePress() {
    navigation.navigate('PostAlbumStack', {
      screen: 'AlbumScreen',
      params: { albumId: album.id },
    });
  }

  if (!thumbnailAsset) return null;

  return (
    <TouchableOpacity onPress={handlePress}>
      <View style={{ height: size }}>
        <AssetImage asset={thumbnailAsset} />
      </View>
      <View style={styles.footer}>
        <View>
          <Text style={styles.albumName}>{album.name}</Text>
          <Text style={styles.numberOfAssets}>{numberOfAssets} Assets</Text>
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
  albumName: {
    marginTop: 5,
    fontWeight: 'bold',
  },
  numberOfAssets: {
    color: 'gray',
    fontSize: 12,
  },
});
