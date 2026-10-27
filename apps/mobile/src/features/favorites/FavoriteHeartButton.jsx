import IconButton from '@/components/IconButton';
import { colors } from '@/styles/designTokens';

/** The heart of a post that can be a favorite: filled red while it is one; a tap calls `onPress`. */
export default function FavoriteHeartButton({ isFavorite, onPress }) {
  return (
    <IconButton
      icon="heart"
      filled={isFavorite}
      color={isFavorite ? colors.status.danger : colors.text.secondary}
      onPress={onPress}
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    />
  );
}
