import Icon from '@/components/Icon';
import { colors, spacing } from '@/styles/designTokens';

export default function FavoriteAlbumIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Icon name="star" filled size={spacing.iconSize} color={colors.textInverse} />;
}
