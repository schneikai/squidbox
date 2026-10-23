import FloatingPill from './FloatingPill';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
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
          <GradientButton key={key} onPress={() => onSelect(key)} accessibilityLabel={label}>
            <Icon name={icon} color={colors.iconActive} />
          </GradientButton>
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
