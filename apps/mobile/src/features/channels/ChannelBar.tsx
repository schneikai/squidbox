import { channelById, type Channel } from '@squidbox/shared';
import { type StyleProp, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import ChannelLogo from './ChannelLogo';
import ChannelLogos from './ChannelLogos';
import VersionMenu from './VersionMenu';
import orderChannelIds from './orderChannelIds';
import versionLabel from './versionLabel';

import Chip from '@/components/Chip';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { space } from '@/styles/designTokens';

/** One version of a post on the bar: the post's own, or another version; `channelIds` the channels it goes to. */
export type ChannelBarPart = { key: string; channelIds: readonly string[] };

/**
 * What the editor adds to the bar: the user's `channels` to add or tick, and what each does: `onAdd`
 * a version for one channel, `onToggle` ticks a channel on the selected version or unticks it,
 * `onSplit` writes one of its channels separately, `onRemove` removes it.
 */
export type ChannelBarEditing = {
  channels: Channel[];
  onAdd: (channelId: string) => void;
  onToggle: (channelId: string) => void;
  onSplit: (channelId: string) => void;
  onRemove?: () => void;
};

type ChannelBarProps = {
  parts: ChannelBarPart[];
  selectedKey: string;
  onSelect: (key: string) => void;
  channelOrder: string[];
  editing?: ChannelBarEditing;
  style?: StyleProp<ViewStyle>;
};

/**
 * A post's versions as a row of chips (tabs), one per part of `parts` in bar order (the caller's
 * orderPostChannels): each its channels' logos and names ("Bluesky, X", read "Bluesky and X":
 * versionLabel), in the user's `channelOrder`, the selected one (`selectedKey`) white. A tap on
 * another calls `onSelect(key)`, with a selection tap.
 * With `editing` (the editor) every chip has a caret, so none changes width when another is
 * selected, and a tap on the selected one opens its menu (VersionMenu: This version is for, its
 * channels and the user's channels no part is on, to tick; Write <channel> separately; Remove this
 * version with `onRemove`); and a dashed + after the chips opens Add channel, the channels no part
 * is on (no + when there are none). The row scrolls sideways under the edges of a parent padded by
 * the screen's padding.
 */
export default function ChannelBar({ parts, selectedKey, onSelect, channelOrder, editing, style }: ChannelBarProps) {
  const haptics = useHaptics();

  const used = new Set(parts.flatMap((part) => part.channelIds));
  const unused = editing?.channels.filter((channel) => !used.has(channel.id)) ?? [];

  function handleSelect(key: string) {
    haptics.selection();
    onSelect(key);
  }

  function renderChip(part: ChannelBarPart) {
    // The version's channels in the user's order, once, for its label, logos and menu.
    const channelIds = orderChannelIds(part.channelIds, channelOrder);
    const known = channelIds.filter((id) => channelById(id));
    const isSelected = part.key === selectedKey;
    const chipProps = {
      ...versionLabel(channelIds),
      mark: known.length > 0 && <ChannelLogos channelIds={known} isDecorative />,
      isSelected,
      hasCaret: !!editing,
      accessibilityRole: 'tab',
    } as const;
    // The selected tab opens its menu when it offers something: a channel to tick, a channel to write
    // separately or Remove. Not for the post's lone version with every channel used.
    if (isSelected && editing && (known.length > 1 || unused.length > 0 || editing.onRemove)) {
      return (
        <VersionMenu
          key={part.key}
          channelIds={channelIds}
          unused={unused}
          channelOrder={channelOrder}
          onToggle={editing.onToggle}
          onSplit={editing.onSplit}
          onRemove={editing.onRemove}
          trigger={({ toggle, isOpen }) => <Chip {...chipProps} onPress={toggle} isExpanded={isOpen} />}
        />
      );
    }
    return <Chip key={part.key} {...chipProps} onPress={isSelected ? undefined : () => handleSelect(part.key)} />;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      style={[styles.row, style]}
      contentContainerStyle={styles.content}
    >
      {parts.map(renderChip)}
      {editing && unused.length > 0 && (
        <MenuButton
          title="Add channel"
          trigger={({ toggle, isOpen }) => (
            <Chip variant="add" label="Add channel" isIconOnly onPress={toggle} isExpanded={isOpen} />
          )}
        >
          {unused.map((channel) => (
            <MenuOption
              key={channel.id}
              label={channel.name}
              leading={<ChannelLogo channelId={channel.id} />}
              onPress={() => editing.onAdd(channel.id)}
            />
          ))}
        </MenuButton>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Across the parent's padding, so the chips scroll under the screen's edges.
  row: {
    flexGrow: 0,
    marginHorizontal: -SCREEN_PADDING,
  },
  content: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: SCREEN_PADDING,
  },
});
