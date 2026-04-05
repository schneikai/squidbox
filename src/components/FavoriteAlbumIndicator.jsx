import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography } from '@/styles/designTokens';

export default function FavoriteAlbumIndicator({ isFavorite }) {
  if(!isFavorite) return;
  
  return (
    <Ionicons name="star" style={styles.favoriteAlbumIndicator} />
  )
}

const styles = StyleSheet.create({
  favoriteAlbumIndicator: {
    fontSize: typography.lg,
    color: colors.textInverse,
  },
});
