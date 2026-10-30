import Button from '@/components/Button';

/**
 * The heart of a post that can be a favorite: filled red while it is one; a tap calls `onPress`.
 * `accessibilityLabel` replaces the one it says by itself ("Add to favorites" or "Remove from
 * favorites").
 */
export default function FavoriteHeartButton({ isFavorite, onPress, accessibilityLabel }) {
  return (
    <Button
      icon="heart"
      colorPalette="favorite"
      isSelected={isFavorite}
      filled={isFavorite}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? (isFavorite ? 'Remove from favorites' : 'Add to favorites')}
    />
  );
}
