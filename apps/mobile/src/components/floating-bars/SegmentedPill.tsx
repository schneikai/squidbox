import { Pressable, StyleSheet, Text, View } from 'react-native';

import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import type { IconName } from '@/components/Icon';
import { colors, press, radii, shadows, sizes, space, textStyles } from '@/styles/designTokens';

// `icon` makes an icon segment; without one the segment is its `label`.
export type SegmentedPillItem<Key extends string = string> = { key: Key; icon?: IconName; label: string };

type SegmentedPillSize = 'regular' | 'title';

export type SegmentedPillProps<Key extends string> = {
  items: SegmentedPillItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
  size?: SegmentedPillSize;
};

/**
 * A toolbar of segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; an icon segment's active one is the purple button. An item
 * without an `icon` is a text segment that shows its `label`: the active one a white thumb raised off
 * the glass, in dark text, the others grey. `size="title"` makes text segments one button tall with a
 * larger label, for a switcher that is the screen's title (the Contacts tab's Contacts | Lists): VoiceOver reads the
 * active one as the screen's header and the others as tabs. The pill is a tablist.
 */
export default function SegmentedPill<Key extends string>({
  items,
  activeKey,
  onSelect,
  size = 'regular',
}: SegmentedPillProps<Key>) {
  return (
    <View accessibilityRole="tablist">
      <FloatingPill>
        {items.map(({ key, icon, label }) =>
          !icon ? (
            <TextSegment
              key={key}
              label={label}
              size={size}
              isActive={key === activeKey}
              onPress={() => onSelect(key)}
            />
          ) : key === activeKey ? (
            <Button
              variant="primary"
              icon={icon}
              isSelected
              key={key}
              onPress={() => onSelect(key)}
              accessibilityLabel={label}
            />
          ) : (
            <Button key={key} icon={icon} onPress={() => onSelect(key)} accessibilityLabel={label} />
          ),
        )}
      </FloatingPill>
    </View>
  );
}

type TextSegmentProps = { label: string; size: SegmentedPillSize; isActive: boolean; onPress: () => void };

function TextSegment({ label, size, isActive, onPress }: TextSegmentProps) {
  const isTitle = size === 'title';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={isTitle && isActive ? 'header' : 'tab'}
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.segment,
        isTitle && styles.titleSegment,
        isActive && styles.active,
        pressed && !isActive && press.flat,
      ]}
    >
      <Text style={[styles.label, isTitle && styles.titleLabel, isActive && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.pill,
  },
  active: {
    backgroundColor: colors.background.surface,
    ...shadows.thumb,
  },
  // One weight on and off, so a segment keeps its width when it's picked; only the color changes.
  label: {
    ...textStyles.subheadlineBold,
    color: colors.text.secondary,
  },
  // One button tall, so the pill is as tall as the toolbars and the + beside it.
  titleSegment: {
    height: sizes.iconButton,
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: space.lg,
  },
  titleLabel: textStyles.bodyBold,
  activeLabel: {
    color: colors.text.primary,
  },
});
