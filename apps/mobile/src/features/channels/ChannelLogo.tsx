import type { ChannelId } from '@squidbox/shared';
import Svg, { Path } from 'react-native-svg';

import { CHANNEL_GLYPHS } from './channelGlyphs';

import { colors, sizes } from '@/styles/designTokens';

type Glyph = keyof typeof CHANNEL_GLYPHS;

// Each channel's glyph: a catalog channel without one fails the typecheck. OnlyFans PPV is a way of
// posting on OnlyFans, so it has OnlyFans's.
const GLYPH_OF: Record<ChannelId, Glyph> = {
  x: 'x',
  bluesky: 'bluesky',
  threads: 'threads',
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  reddit: 'reddit',
  patreon: 'patreon',
  onlyfans: 'onlyfans',
  'onlyfans-ppv': 'onlyfans',
};

export type ChannelLogoProps = { channelId: string; size?: number };

/** A channel's official logo in its brand color (Simple Icons); nothing for an id the catalog doesn't know. */
export default function ChannelLogo({ channelId, size = sizes.icon }: ChannelLogoProps) {
  const glyph = (GLYPH_OF as Record<string, Glyph | undefined>)[channelId];
  if (!glyph) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={CHANNEL_GLYPHS[glyph]} fill={colors.brand[glyph]} />
    </Svg>
  );
}
