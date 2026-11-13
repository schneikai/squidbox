import { channelById, channelName, type Channel } from '@squidbox/shared';
import { type StyleProp, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import ChannelLogo from './ChannelLogo';

import Chip from '@/components/Chip';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { sizes, space } from '@/styles/designTokens';

/** One channel of a post on the bar: the post's own, or another channel's copy. */
export type ChannelBarPart = { key: string; channelId: string | null };

/** What the editor adds to the bar: the user's `channels` to add or change to, and what each does. */
export type ChannelBarEditing = {
  channels: Channel[];
  onAdd: (channelId: string) => void;
  onChange: (channelId: string) => void;
  onRemove?: () => void;
};

type ChannelBarProps = {
  parts: ChannelBarPart[];
  selectedKey: string;
  onSelect: (key: string) => void;
  editing?: ChannelBarEditing;
  style?: StyleProp<ViewStyle>;
};

/**
 * A post's channels as a row of chips (tabs), one per part of `parts` in bar order (the caller's
 * orderPostChannels): each its channel's logo and name, the selected one (`selectedKey`) white. A tap
 * on another calls `onSelect(key)`, with a selection tap.
 * With `editing` (the editor) every chip has a caret, so none changes width when another is
 * selected, and a tap on the selected one opens its menu: Change <Channel> to, the user's channels no
 * part is on, then Remove <Channel> with `onRemove` (no menu when it would be empty); and a dashed +
 * after the chips opens Add channel, the same channels (no + when there are none). The row scrolls
 * sideways under the edges of a parent padded by the screen's padding.
 */
export default function ChannelBar({ parts, selectedKey, onSelect, editing, style }: ChannelBarProps) {
  const haptics = useHaptics();

  const used = new Set(parts.flatMap((part) => (part.channelId ? [part.channelId] : [])));
  const unused = editing?.channels.filter((channel) => !used.has(channel.id)) ?? [];

  function handleSelect(key: string) {
    haptics.selection();
    onSelect(key);
  }

  function channelOptions(onPick: (channelId: string) => void) {
    return unused.map((channel) => (
      <MenuOption
        key={channel.id}
        label={channel.name}
        leading={<ChannelLogo channelId={channel.id} />}
        onPress={() => onPick(channel.id)}
      />
    ));
  }

  function renderChip(part: ChannelBarPart) {
    const label = channelName(part.channelId);
    const current = channelById(part.channelId);
    const isSelected = part.key === selectedKey;
    const chipProps = {
      label,
      mark: current && <ChannelLogo channelId={current.id} size={sizes.menuIcon} />,
      isSelected,
      hasCaret: !!editing,
      accessibilityRole: 'tab',
    } as const;
    // The selected tab opens its menu, unless it would be empty (a lone post on every channel).
    if (isSelected && editing && (unused.length > 0 || editing.onRemove)) {
      return (
        <MenuButton
          key={part.key}
          title={unused.length > 0 ? `Change ${label} to` : undefined}
          trigger={({ toggle, isOpen }) => <Chip {...chipProps} onPress={toggle} isExpanded={isOpen} />}
        >
          {channelOptions(editing.onChange)}
          {editing.onRemove && (
            <MenuOption
              key="remove"
              label={`Remove ${label}`}
              icon="trash"
              colorPalette="danger"
              onPress={editing.onRemove}
            />
          )}
        </MenuButton>
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
          {channelOptions(editing.onAdd)}
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
