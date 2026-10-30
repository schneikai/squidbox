import { StyleSheet, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import { colors, radii, sizes } from '@/styles/designTokens';

/**
 * An album's cover, or the thumbnail of a row that stands for a post: `asset`'s thumbnail with
 * rounded corners (or the picture at `uri`, a data URL say), an image icon on its placeholder without
 * either. The parent sets its size;
 * `children` draw over it (e.g. corner badges).
 */
export default function CoverImage({ asset, uri, style, children }) {
  return (
    <View style={[styles.cover, style]}>
      <AssetImage asset={asset} uri={uri} />
      {!asset?.thumbnailFilename && !uri && (
        <View style={styles.icon} pointerEvents="none">
          <Icon name="image" size={sizes.iconLarge} color={colors.text.tertiary} />
        </View>
      )}
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
