import { channelById, type Channel } from '@squidbox/shared';

import ChannelLogo from './ChannelLogo';

import Chip from '@/components/Chip';
import Divider from '@/components/Divider';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { sizes } from '@/styles/designTokens';

export type ChannelSelectorProps = {
  channelId: string | null;
  channels: Channel[];
  disabledIds: Set<string>;
  onChange: (channelId: string) => void;
  onAddChannel?: () => void;
};

/**
 * The channel a post's card is on, as a chip with its logo, its name (No channel without one) and a
 * caret, opening a menu to switch it: the user's `channels`, then the card's own channel when it isn't
 * among them; the current one marked, the ones in `disabledIds` (the post's other channels) off; then,
 * with `onAddChannel`, Add channel in a group of its own.
 */
export default function ChannelSelector({
  channelId,
  channels,
  disabledIds,
  onChange,
  onAddChannel,
}: ChannelSelectorProps) {
  const current = channelById(channelId);
  const name = current?.name ?? 'No channel';
  const options = current && !channels.some((channel) => channel.id === current.id) ? [...channels, current] : channels;

  return (
    <MenuButton
      isGrouped
      trigger={({ toggle }) => (
        <Chip
          label={name}
          leading={current && <ChannelLogo channelId={current.id} size={sizes.menuIcon} />}
          isLeadingInset
          hasCaret
          onPress={toggle}
          accessibilityLabel={`Channel: ${name}`}
        />
      )}
    >
      {options.map((channel) => (
        <MenuOption
          key={channel.id}
          label={channel.name}
          leading={<ChannelLogo channelId={channel.id} />}
          isSelected={channel.id === current?.id}
          disabled={channel.id !== current?.id && disabledIds.has(channel.id)}
          onPress={() => onChange(channel.id)}
        />
      ))}
      {onAddChannel && <Divider key="add-divider" variant="menu" />}
      {onAddChannel && <MenuOption key="add" label="Add channel" icon="add" onPress={onAddChannel} />}
    </MenuButton>
  );
}
