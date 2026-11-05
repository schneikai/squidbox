import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import type { IconName } from '@/components/Icon';

export type SegmentedPillItem = { key: string; icon: IconName; label: string };

export type SegmentedPillProps = {
  items: SegmentedPillItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

/**
 * A toolbar of icon segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; the active one is the purple button.
 */
export default function SegmentedPill({ items, activeKey, onSelect }: SegmentedPillProps) {
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
