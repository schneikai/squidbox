import { StyleSheet, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { colors, radii, sizes } from '@/styles/designTokens';

/**
 * An album's cover, or the thumbnail of a row that stands for a post: `asset`'s thumbnail with
 * rounded corners (or the picture at `uri`, a data URL say), an image icon on its placeholder without
 * either. The parent sets its size; `moreCount` > 0 shows "+N" in its `moreCorner` (bottomRight, or
 * bottomRightSmall on a small thumbnail) for the pictures it stands for too; `children` draw over
 * it (e.g. corner badges).
 *
 * @param {{
 *   asset?: object | null,
 *   uri?: string,
 *   moreCount?: number,
 *   moreCorner?: 'bottomRight' | 'bottomRightSmall',
 *   style?: import('react-native').StyleProp<import('react-native').ViewStyle>,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function CoverImage({ asset, uri, moreCount = 0, moreCorner = 'bottomRight', style, children }) {
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
