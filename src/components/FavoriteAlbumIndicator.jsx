import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function FavoriteAlbumIndicator({ isFavorite }) {
  if(!isFavorite) return;
  
  return (
    <Ionicons name="star" style={styles.favoriteAlbumIndicator} />
  )
}

const styles = StyleSheet.create({
  favoriteAlbumIndicator: {
    fontSize: 20,
    color: "white",
  },
});
