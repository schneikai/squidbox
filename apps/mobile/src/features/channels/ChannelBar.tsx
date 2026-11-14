import { channelById, type Channel } from '@squidbox/shared';
import { type StyleProp, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import ChannelLogos from './ChannelLogos';
import NewVersionMenu from './NewVersionMenu';
import VersionMenu from './VersionMenu';
import isAllChannels from './isAllChannels';
import orderChannelIds from './orderChannelIds';
import versionLabel from './versionLabel';

import Chip from '@/components/Chip';
import { SCREEN_PADDING } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { space } from '@/styles/designTokens';

/** One version of a post on the bar: the post's own, or another version; `channelIds` the channels it goes to. */
export type ChannelBarPart = { key: string; channelIds: readonly string[] };

/**
 * What the editor adds to the bar: the user's `channels` to tick, and what a tick does: `onToggle`
 * ticks a channel on the selected version or unticks it, `onKeep` (a long press) makes it the selected
 * version's only channel, `onNewVersion` gives a channel a version of
 * its own (a copy of the one that shows), `onRemove` removes the selected version (none for the post's
 * only one).
 */
export type ChannelBarEditing = {
  channels: Channel[];
  onToggle: (channelId: string) => void;
  onKeep: (channelId: string) => void;
  onNewVersion: (channelId: string) => void;
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
 * orderPostChannels): each its channels' logos in the user's `channelOrder` (read "Bluesky and X":
 * versionLabel), or All channels, without logos, when it goes to every one of the user's channels; the
 * selected one (`selectedKey`) white. A tap on another calls `onSelect(key)`, with a selection tap.
 * With `editing` (the editor) every chip has a caret, so none changes width when another is
 * selected, and a tap on the selected one opens its menu (VersionMenu, This version is for: every one
 * of the user's channels to tick or untick, unticking the last removing the version); and a dashed +
 * after the chips opens New version for (NewVersionMenu). The row scrolls sideways under the edges of
 * a parent padded by the screen's padding.
 */
export default function ChannelBar({ parts, selectedKey, onSelect, channelOrder, editing, style }: ChannelBarProps) {
  const haptics = useHaptics();

  // Channels alone on a version: ticking one onto another version removes its own.
  const aloneIds = new Set(parts.flatMap((part) => (part.channelIds.length === 1 ? part.channelIds : [])));
  const selected = parts.find((part) => part.key === selectedKey);

  function handleSelect(key: string) {
    haptics.selection();
    onSelect(key);
  }

  function renderChip(part: ChannelBarPart) {
    // The version's channels in the user's order, once, for its label, logos and menu.
    const channelIds = orderChannelIds(part.channelIds, channelOrder);
    const known = channelIds.filter((id) => channelById(id));
    const isSelected = part.key === selectedKey;
    // Its logos alone, the names in its menu and for VoiceOver; All channels (or no channel this build
    // knows) as text.
    const hasLogos = known.length > 0 && !isAllChannels(channelIds, channelOrder);
    const chipProps = {
      ...versionLabel(channelIds, channelOrder),
      mark: hasLogos && <ChannelLogos channelIds={known} isDecorative />,
      isIconOnly: hasLogos,
      isSelected,
      hasCaret: !!editing,
      accessibilityRole: 'tab',
    } as const;
    // The selected tab opens its menu when it offers something: a channel to tick or untick (its last
    // one removing it). Not for the post's lone version on its only channel.
    if (isSelected && editing && (editing.channels.length > 1 || editing.onRemove)) {
      return (
        <VersionMenu
          key={part.key}
          channelIds={channelIds}
          channels={editing.channels}
          aloneIds={aloneIds}
          channelOrder={channelOrder}
          onToggle={editing.onToggle}
          onKeep={editing.onKeep}
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
      {editing && selected && (
        <NewVersionMenu selected={selected} aloneIds={aloneIds} channelOrder={channelOrder} editing={editing} />
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
