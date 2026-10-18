import { StyleSheet, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import { colors, radii, spacing } from '@/styles/designTokens';

/**
 * An album's cover, or the thumbnail of a row that stands for a post: `asset`'s thumbnail with
 * rounded corners, an image icon on its placeholder without one. The parent sets its size;
 * `children` draw over it (e.g. corner badges).
 */
export default function CoverImage({ asset, style, children }) {
  return (
    <View style={[styles.cover, style]}>
      <AssetImage asset={asset} />
      {!asset?.thumbnailFilename && (
        <View style={styles.icon} pointerEvents="none">
          <Icon name="image" size={spacing.iconSizeLarge} color={colors.textTertiary} />
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
