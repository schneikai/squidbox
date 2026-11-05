import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import type { IconName } from '@/components/Icon';

export type SegmentedPillItem<Key extends string = string> = { key: Key; icon: IconName; label: string };

export type SegmentedPillProps<Key extends string> = {
  items: SegmentedPillItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
};

/**
 * A toolbar of icon segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; the active one is the purple button.
 */
export default function SegmentedPill<Key extends string>({ items, activeKey, onSelect }: SegmentedPillProps<Key>) {
  return (
    <FloatingPill>
      {items.map(({ key, icon, label }) =>
        key === activeKey ? (
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
  );
}
