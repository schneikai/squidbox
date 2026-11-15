import type { ChannelId } from '@squidbox/shared';
import Svg, { Path } from 'react-native-svg';

import { CHANNEL_GLYPHS } from './channelGlyphs';

import { colors, sizes } from '@/styles/designTokens';

export type ChannelLogoProps = { channelId: string; size?: number };

/** A channel's official logo in its brand color (Simple Icons); nothing for an id the catalog doesn't know. */
export default function ChannelLogo({ channelId, size = sizes.icon }: ChannelLogoProps) {
  if (!(channelId in CHANNEL_GLYPHS)) return null;
  const glyph = channelId as ChannelId;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={CHANNEL_GLYPHS[glyph]} fill={colors.brand[glyph]} />
    </Svg>
  );
}
