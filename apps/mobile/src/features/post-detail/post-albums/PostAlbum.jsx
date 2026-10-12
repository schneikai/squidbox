import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import AssetImage from '@/components/AssetImage';
import { colors, scale } from '@/styles/designTokens';

export default function PostAlbum({ album, cover, size }) {
  const navigation = useNavigation();
  const { thumbnailAsset, numberOfAssets } = cover ?? {};

  async function handlePress() {
    navigation.navigate('AlbumScreen', { albumId: album.id });
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
    color: colors.textSecondary,
    fontSize: scale(12),
  },
});
