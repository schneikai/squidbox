import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

export type FavoriteAlbumIndicatorProps = { isFavorite?: boolean };

export default function FavoriteAlbumIndicator({ isFavorite }: FavoriteAlbumIndicatorProps) {
  if (!isFavorite) return;

  return <Icon name="star" filled size={sizes.icon} color={colors.text.inverse} />;
}
