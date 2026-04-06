import Icon from '@/components/Icon';
import { colors, typography } from '@/styles/designTokens';

export default function FavoriteAlbumIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Icon name="star" filled size={typography.lg} color={colors.textInverse} />;
}
