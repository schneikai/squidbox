import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import AssetImage from '@/components/AssetImage';
import { colors, scale } from '@/styles/designTokens';

// `album` is an albumQuery row: it carries its cover and stats.
export default function PostAlbum({ album, size }) {
  const navigation = useNavigation();

  async function handlePress() {
    navigation.navigate('AlbumScreen', { albumId: album.id });
  }

  if (!album.cover) return null;

  return (
    <TouchableOpacity onPress={handlePress}>
      <View style={{ height: size }}>
        <AssetImage asset={album.cover} />
      </View>
      <View style={styles.footer}>
        <View>
          <Text style={styles.albumName}>{album.name}</Text>
          <Text style={styles.numberOfAssets}>{album.assetCount} Assets</Text>
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
