import { channelById, type Channel } from '@squidbox/shared';
import { type StyleProp, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import ChannelLogo from './ChannelLogo';
import channelName from './channelName';
import orderPostChannels from './orderPostChannels';

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
  channelOrder: string[];
  selectedKey: string;
  onSelect: (key: string) => void;
  editing?: ChannelBarEditing;
  style?: StyleProp<ViewStyle>;
};

/**
 * A post's channels as a row of chips (tabs), one per part of `parts` (the post's own first), in bar
 * order (orderPostChannels over `channelOrder`): each its channel's logo and name, the selected one
 * (`selectedKey`) white. A tap on another calls `onSelect(key)`, with a selection tap.
 * With `editing` (the editor) every chip has a caret, so none changes width when another is
 * selected, and a tap on the selected one opens its menu: Change <Channel> to, the user's channels no
 * part is on, then Remove <Channel> with `onRemove` (no menu when it would be empty); and a dashed + after the chips opens Add channel, the
 * user's channels no part is on (no + when there are none). The row scrolls sideways under the edges of
 * a parent padded by the screen's padding.
 */
export default function ChannelBar({ parts, channelOrder, selectedKey, onSelect, editing, style }: ChannelBarProps) {
  const haptics = useHaptics();

  const ordered = orderPostChannels(parts, (part) => part.channelId, channelOrder);
  const used = new Set(parts.flatMap((part) => (part.channelId ? [part.channelId] : [])));
  const unused = editing?.channels.filter((channel) => !used.has(channel.id)) ?? [];

  function handleSelect(key: string) {
    haptics.selection();
    onSelect(key);
  }

  function renderChip(part: ChannelBarPart) {
    const label = channelName(part.channelId);
    const current = channelById(part.channelId);
    const mark = current && <ChannelLogo channelId={current.id} size={sizes.menuIcon} />;
    if (part.key !== selectedKey) {
      return (
        <Chip
          key={part.key}
          label={label}
          mark={mark}
          hasCaret={!!editing}
          accessibilityRole="tab"
          onPress={() => handleSelect(part.key)}
        />
      );
    }
    if (!editing) return <Chip key={part.key} label={label} mark={mark} isSelected accessibilityRole="tab" />;
    // Nothing to change to and nothing to remove (a lone post on every channel): a plain selected tab.
    if (unused.length === 0 && !editing.onRemove) {
      return <Chip key={part.key} label={label} mark={mark} isSelected hasCaret accessibilityRole="tab" />;
    }
    return (
      <MenuButton
        key={part.key}
        title={unused.length > 0 ? `Change ${label} to` : undefined}
        trigger={({ toggle, isOpen }) => (
          <Chip
            label={label}
            mark={mark}
            isSelected
            hasCaret
            accessibilityRole="tab"
            onPress={toggle}
            isExpanded={isOpen}
          />
        )}
      >
        {unused.map((channel) => (
          <MenuOption
            key={channel.id}
            label={channel.name}
            leading={<ChannelLogo channelId={channel.id} />}
            onPress={() => editing.onChange(channel.id)}
          />
        ))}
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

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      style={[styles.row, style]}
      contentContainerStyle={styles.content}
    >
      {ordered.map(renderChip)}
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
