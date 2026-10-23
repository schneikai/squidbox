import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

export default function FavoriteAlbumIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Icon name="star" filled size={sizes.icon} color={colors.text.inverse} />;
}
