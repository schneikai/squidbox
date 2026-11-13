import { channelById } from '@squidbox/shared';

import ChannelLogo from './ChannelLogo';

import Chip from '@/components/Chip';
import { sizes } from '@/styles/designTokens';

export type ChannelLabelProps = { channelId: string };

/** A channel's logo and name as a chip (a post in a list). Nothing for an id the catalog doesn't know. */
export default function ChannelLabel({ channelId }: ChannelLabelProps) {
  const channel = channelById(channelId);
  if (!channel) return null;
  return (
    <Chip label={channel.name} leading={<ChannelLogo channelId={channel.id} size={sizes.menuIcon} />} isLeadingInset />
  );
}
