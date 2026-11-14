import { channelById, channelName, type Channel } from '@squidbox/shared';

import ChannelLogo from './ChannelLogo';
import orderChannelIds from './orderChannelIds';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';

type VersionMenuProps = {
  channelIds: readonly string[];
  unused: Channel[];
  channelOrder: string[];
  onToggle: (channelId: string) => void;
  onSplit: (channelId: string) => void;
  onRemove?: () => void;
  trigger: NonNullable<MenuButtonProps['trigger']>;
};

/**
 * The menu of a version's selected chip in the editor, "This version is for": one row per channel the
 * version is on (`channelIds`, already in the user's order) or the post isn't on yet (`unused`), in the user's order
 * (`channelOrder`), so none moves when ticked, each with its logo and a select circle. A tap ticks or
 * unticks it (`onToggle`) and the menu stays open; the version's only channel can't be unticked (the
 * version is removed instead). A channel this build doesn't know has no rows. Then, on a version of
 * two or more channels, Write <channel> separately for each (`onSplit`: it gets a version of its own,
 * a copy of this one), and Remove this version with `onRemove`.
 */
export default function VersionMenu({
  channelIds,
  unused,
  channelOrder,
  onToggle,
  onSplit,
  onRemove,
  trigger,
}: VersionMenuProps) {
  const haptics = useHaptics();

  const rows = orderChannelIds([...channelIds, ...unused.map((channel) => channel.id)], channelOrder).flatMap(
    (id) => channelById(id) ?? [],
  );
  const isShared = channelIds.length > 1;
  const splittable = isShared ? channelIds.filter((id) => channelById(id)) : [];

  function handleToggle(channelId: string) {
    haptics.selection();
    onToggle(channelId);
    return false;
  }

  return (
    <MenuButton title="This version is for" trigger={trigger}>
      {rows.map((channel) => {
        const isSelected = channelIds.includes(channel.id);
        return (
          <MenuOption
            key={channel.id}
            label={channel.name}
            leading={<ChannelLogo channelId={channel.id} />}
            selection="several"
            isSelected={isSelected}
            isDisabled={isSelected && !isShared}
            onPress={() => handleToggle(channel.id)}
          />
        );
      })}
      {(isShared || onRemove) && <Divider key="actions" variant="menu" />}
      {splittable.map((channelId) => (
        <MenuOption
          key={`split-${channelId}`}
          label={`Write ${channelName(channelId)} separately`}
          icon="copy"
          onPress={() => onSplit(channelId)}
        />
      ))}
      {onRemove && (
        <MenuOption key="remove" label="Remove this version" icon="trash" colorPalette="danger" onPress={onRemove} />
      )}
    </MenuButton>
  );
}
