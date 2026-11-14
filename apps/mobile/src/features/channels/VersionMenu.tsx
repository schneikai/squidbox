import { channelById, type Channel } from '@squidbox/shared';

import ChannelLogo from './ChannelLogo';
import orderChannelIds from './orderChannelIds';

import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';

type VersionMenuProps = {
  title?: string;
  channelIds: readonly string[];
  channels: Channel[];
  aloneIds: ReadonlySet<string>;
  disabledId?: string;
  channelOrder: string[];
  onToggle: (channelId: string) => void;
  onKeep: (channelId: string) => void;
  onRemove?: () => void;
  trigger: NonNullable<MenuButtonProps['trigger']>;
};

/**
 * The editor's menu of a version's channels, headed `title` (This version is for, the selected chip's
 * menu; New version for, +'s): one row per channel the version is on (`channelIds`) and per one of the
 * user's `channels`, in the user's order (`channelOrder`) so none moves when ticked, each with its logo
 * and a select circle (ticked when the version is on it). A tap ticks or unticks it (`onToggle`: a
 * channel on another version moves here) and the menu stays open, except for a channel alone on another
 * version (`aloneIds`): that version goes, so the menu closes for its question. A long press keeps
 * only that channel on the version (`onKeep`: it is ticked, moving here as a tap would, and the others
 * are unticked) and the menu stays open. Unticking the version's
 * only channel closes the menu and removes the version (`onRemove`, which asks first); without
 * `onRemove` (the post's only version) that row is greyed out, as is `disabledId`. A channel this build
 * doesn't know has no row.
 */
export default function VersionMenu({
  title = 'This version is for',
  channelIds,
  channels,
  aloneIds,
  disabledId,
  channelOrder,
  onToggle,
  onKeep,
  onRemove,
  trigger,
}: VersionMenuProps) {
  const haptics = useHaptics();

  const ids = new Set([...channelIds, ...channels.map((channel) => channel.id)]);
  const rows = orderChannelIds([...ids], channelOrder).flatMap((id) => channelById(id) ?? []);
  const isShared = channelIds.length > 1;

  function handleToggle(channelId: string) {
    haptics.selection();
    onToggle(channelId);
    return aloneIds.has(channelId) ? undefined : false;
  }

  function handleKeep(channelId: string) {
    haptics.selection();
    onKeep(channelId);
  }

  return (
    <MenuButton title={title} trigger={trigger}>
      {rows.map((channel) => {
        const isSelected = channelIds.includes(channel.id);
        const isLast = isSelected && !isShared;
        return (
          <MenuOption
            key={channel.id}
            label={channel.name}
            leading={<ChannelLogo channelId={channel.id} />}
            selection="several"
            isSelected={isSelected}
            isDisabled={(isLast && !onRemove) || channel.id === disabledId}
            onPress={() => (isLast ? onRemove?.() : handleToggle(channel.id))}
            onLongPress={() => handleKeep(channel.id)}
          />
        );
      })}
    </MenuButton>
  );
}
