import FloatingPill from './FloatingPill';

import IconButton from '@/components/IconButton';
import { colors } from '@/styles/designTokens';

/**
 * A toolbar of icon segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; the active one is the purple button.
 */
export default function SegmentedPill({ items, activeKey, onSelect }) {
  return (
    <FloatingPill>
      {items.map(({ key, icon, label }) =>
        key === activeKey ? (
          <IconButton
            variant="primary"
            icon={icon}
            isActive
            key={key}
            onPress={() => onSelect(key)}
            accessibilityLabel={label}
          />
        ) : (
          <IconButton
            key={key}
            icon={icon}
            onPress={() => onSelect(key)}
            color={colors.iconInactive}
            accessibilityLabel={label}
          />
        ),
      )}
    </FloatingPill>
  );
}
