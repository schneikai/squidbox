import { channelById, type Channel } from '@squidbox/shared';
import { type StyleProp, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import ChannelLogo from './ChannelLogo';
import channelName from './channelName';
import orderPostChannels from './orderPostChannels';

import Bubble from '@/components/Bubble';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { raisedShadowRoom, space } from '@/styles/designTokens';

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
 * A post's channels as a row of bubbles (tabs), one per part of `parts` (the post's own first), in bar
 * order (orderPostChannels over `channelOrder`): each its channel's logo and name, the selected one
 * (`selectedKey`) a white pill. A tap on another calls `onSelect(key)`, with a selection tap.
 * With `editing` (the editor) the selected pill has a caret and opens Channel of this post: the user's
 * channels (and the part's own when it isn't among them), the current one marked, one another part is
 * on off, then Remove <Channel> with `onRemove`; and a dashed + after the bubbles opens Add channel, the
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

  function renderBubble(part: ChannelBarPart) {
    const label = channelName(part.channelId);
    const current = channelById(part.channelId);
    const mark = current && <ChannelLogo channelId={current.id} />;
    if (part.key !== selectedKey) {
      return <Bubble key={part.key} label={label} mark={mark} onPress={() => handleSelect(part.key)} />;
    }
    if (!editing) return <Bubble key={part.key} label={label} mark={mark} isSelected />;
    const options =
      current && !editing.channels.some((channel) => channel.id === current.id)
        ? [...editing.channels, current]
        : editing.channels;
    return (
      <MenuButton
        key={part.key}
        title="Channel of this post"
        trigger={({ toggle, isOpen }) => (
          <Bubble label={label} mark={mark} isSelected hasCaret onPress={toggle} isExpanded={isOpen} />
        )}
      >
        {options.map((channel) => {
          const isCurrent = channel.id === part.channelId;
          return (
            <MenuOption
              key={channel.id}
              label={channel.name}
              leading={<ChannelLogo channelId={channel.id} />}
              isSelected={isCurrent}
              disabled={!isCurrent && used.has(channel.id)}
              onPress={() => !isCurrent && editing.onChange(channel.id)}
            />
          );
        })}
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
      {ordered.map(renderBubble)}
      {editing && unused.length > 0 && (
        <MenuButton
          title="Add channel"
          trigger={({ toggle, isOpen }) => (
            <Bubble variant="add" label="Add channel" onPress={toggle} accessibilityRole="button" isExpanded={isOpen} />
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
  // Across the parent's padding, so the bubbles scroll under the screen's edges, and over the selected
  // pill's shadow, so it isn't cut off.
  row: {
    flexGrow: 0,
    marginHorizontal: -SCREEN_PADDING,
    marginTop: -raisedShadowRoom.top,
    marginBottom: -raisedShadowRoom.bottom,
  },
  content: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: raisedShadowRoom.top,
    paddingBottom: raisedShadowRoom.bottom,
  },
});
