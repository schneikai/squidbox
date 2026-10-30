import FloatingPill from './FloatingPill';

import Button from '@/components/Button';

/**
 * A toolbar of icon segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; the active one is the purple button.
 */
export default function SegmentedPill({ items, activeKey, onSelect }) {
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
