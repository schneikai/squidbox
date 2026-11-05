import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { colors, radii, sizes } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';

type CoverImageProps = {
  asset?: Pick<AssetRow, 'thumbnailFilename'> | null;
  uri?: string;
  moreCount?: number;
  moreCorner?: 'bottomRight' | 'bottomRightSmall';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * An album's cover, or the thumbnail of a row that stands for a post: `asset`'s thumbnail with
 * rounded corners (or the picture at `uri`, a data URL say), an image icon on its placeholder without
 * either. The parent sets its size; `moreCount` > 0 shows "+N" in its `moreCorner` (bottomRight, or
 * bottomRightSmall on a small thumbnail) for the pictures it stands for too; `children` draw over
 * it (e.g. corner badges).
 */
export default function CoverImage({
  asset,
  uri,
  moreCount = 0,
  moreCorner = 'bottomRight',
  style,
  children,
}: CoverImageProps) {
  return (
    <View style={[styles.cover, style]}>
      <AssetImage asset={asset} uri={uri} />
      {!asset?.thumbnailFilename && !uri && (
        <View style={styles.icon} pointerEvents="none">
          <Icon name="image" size={sizes.iconLarge} color={colors.text.tertiary} />
        </View>
      )}
      {moreCount > 0 && <ThumbnailBadge label={`+${moreCount}`} corner={moreCorner} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: radii.cover,
    overflow: 'hidden',
  },
  icon: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
