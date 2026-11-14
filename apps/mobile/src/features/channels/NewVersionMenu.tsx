import { useState } from 'react';

import type { ChannelBarEditing, ChannelBarPart } from './ChannelBar';
import VersionMenu from './VersionMenu';
import orderChannelIds from './orderChannelIds';

import Chip from '@/components/Chip';

type NewVersionMenuProps = {
  selected: ChannelBarPart;
  aloneIds: ReadonlySet<string>;
  channelOrder: string[];
  editing: ChannelBarEditing;
};

/**
 * The channel bar's dashed + and its menu, New version for: the user's channels, none ticked
 * (VersionMenu). The first tick (or long press) gives that channel a version of its own, a copy of the
 * one that shows (`selected`), which then shows (`onNewVersion`); the menu stays open on it, so the
 * next ticks tick or untick channels on that new version (`onToggle`, `onKeep`, `onRemove`). The shown
 * version's channel when it is its only one is greyed out (its copy would be itself), and there is no
 * + when that is all there is.
 */
export default function NewVersionMenu({ selected, aloneIds, channelOrder, editing }: NewVersionMenuProps) {
  // The version that showed when + opened: once another shows, the first tick has made it.
  const [openedOn, setOpenedOn] = useState<string>();

  const own = selected.channelIds.length === 1 ? selected.channelIds[0] : undefined;
  const isMade = openedOn !== undefined && openedOn !== selected.key;
  if (!editing.channels.some((channel) => channel.id !== own)) return null;

  return (
    <VersionMenu
      title="New version for"
      channelIds={isMade ? orderChannelIds(selected.channelIds, channelOrder) : []}
      channels={editing.channels}
      aloneIds={aloneIds}
      disabledId={isMade ? undefined : own}
      channelOrder={channelOrder}
      onToggle={isMade ? editing.onToggle : editing.onNewVersion}
      onKeep={isMade ? editing.onKeep : editing.onNewVersion}
      onRemove={isMade ? editing.onRemove : undefined}
      trigger={({ toggle, isOpen }) => (
        <Chip
          variant="add"
          label="New version"
          isIconOnly
          onPress={() => {
            setOpenedOn(selected.key);
            toggle();
          }}
          isExpanded={isOpen}
        />
      )}
    />
  );
}
