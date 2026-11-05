import FloatingPill from './FloatingPill';

import Button from '@/components/Button';

/**
 * A toolbar of segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; the active one is the purple button. An item without an
 * `icon` is a text segment that shows its `label`.
 */
export default function SegmentedPill({ items, activeKey, onSelect }) {
  return (
    <FloatingPill>
      {items.map(({ key, icon, label }) =>
        key === activeKey ? (
          <Button
            variant="primary"
            icon={icon}
            label={icon ? undefined : label}
            isSelected
            key={key}
            onPress={() => onSelect(key)}
            accessibilityLabel={label}
          />
        ) : (
          <Button
            key={key}
            icon={icon}
            label={icon ? undefined : label}
            colorPalette={icon ? undefined : 'muted'}
            onPress={() => onSelect(key)}
            accessibilityLabel={label}
          />
        ),
      )}
    </FloatingPill>
  );
}
