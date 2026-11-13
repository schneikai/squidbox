import type { ChannelId } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CHANNEL_GLYPHS } from './channelGlyphs';

import Icon from '@/components/Icon';
import { colors, radii, sizes, space } from '@/styles/designTokens';

type Glyph = keyof typeof CHANNEL_GLYPHS;

// Each channel's glyph, and a badge on it where two channels share one: a catalog channel without an
// entry fails the typecheck. OnlyFans PPV is a way of posting on OnlyFans, so it has OnlyFans's glyph,
// with a lock (a PPV message is locked media) to tell the two apart.
const LOGO_OF: Record<ChannelId, { glyph: Glyph; badge?: 'lock' }> = {
  x: { glyph: 'x' },
  bluesky: { glyph: 'bluesky' },
  threads: { glyph: 'threads' },
  instagram: { glyph: 'instagram' },
  tiktok: { glyph: 'tiktok' },
  youtube: { glyph: 'youtube' },
  reddit: { glyph: 'reddit' },
  patreon: { glyph: 'patreon' },
  onlyfans: { glyph: 'onlyfans' },
  'onlyfans-ppv': { glyph: 'onlyfans', badge: 'lock' },
  justforfans: { glyph: 'justforfans' },
};

// The badge's disc, and the icon in it, as parts of the logo's size.
const BADGE_SCALE = 0.6;
const BADGE_ICON_SCALE = 0.4;

export type ChannelLogoProps = { channelId: string; size?: number };

/**
 * A channel's official logo in its brand color (Simple Icons), with its badge at the bottom right
 * where it has one (OnlyFans PPV's lock); nothing for an id the catalog doesn't know.
 */
export default function ChannelLogo({ channelId, size = sizes.icon }: ChannelLogoProps) {
  const logo = (LOGO_OF as Record<string, (typeof LOGO_OF)[ChannelId] | undefined>)[channelId];
  if (!logo) return null;
  const glyph = (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={CHANNEL_GLYPHS[logo.glyph]} fill={colors.brand[logo.glyph]} />
    </Svg>
  );
  if (!logo.badge) return glyph;
  const badgeSize = Math.round(size * BADGE_SCALE);
  const badge = { width: badgeSize, height: badgeSize };
  return (
    <View>
      {glyph}
      <View style={[styles.badge, badge]}>
        <Icon name={logo.badge} size={Math.round(size * BADGE_ICON_SCALE)} color={colors.text.inverse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Over the glyph's corner, a little past it.
  badge: {
    position: 'absolute',
    right: -space.xs,
    bottom: -space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.overlay.dim,
  },
});
