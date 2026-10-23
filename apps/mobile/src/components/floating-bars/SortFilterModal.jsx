import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuItemContent from '@/components/popup-menu-options/MenuItemContent';
import PopoverSurface from '@/components/popup-menu-options/PopoverSurface';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { colors, motion, spacing } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

const DEFAULT_SORT_OPTIONS = [
  { key: 'createdAt', label: 'Created At' },
  { key: 'lastPostedAt', label: 'Last Posted At' },
];

/**
 * The sort / filter / view-options popover over the floating bars. Unlike MenuButton's menus it is
 * not anchored to a trigger: it sits at fixed `bottom`/`left` coordinates in a Modal and drills down
 * into a filter panel, which the anchored menus can't. It shares their surface and rows.
 *
 * Props:
 *   visible         – boolean
 *   onClose         – () => void
 *   sortOrder       – string  e.g. "createdAt:desc"
 *   activeFilter    – string[]
 *   filterOptions   – [{ key, label, icon }]
 *   onSort          – (sortOrder: string) => void
 *   onFilter        – (filterKey: string) => void
 *   showViewOptions – boolean
 *   bottom          – number  (absolute bottom offset)
 *   left            – number  (absolute left offset)
 */
export default function SortFilterModal({
  visible,
  onClose,
  sortOrder = 'createdAt:desc',
  sortOptions = DEFAULT_SORT_OPTIONS,
  activeFilter = [],
  filterOptions = [],
  onSort,
  onFilter,
  showViewOptions = false,
  bottom,
  left,
}) {
  const { thumbnailStyle, setThumbnailStyle } = useAppSettings();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Opens at the root panel, and stays mounted until the exit animation has played.
  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setShowFilterPanel(false);
      Animated.spring(anim, { toValue: 1, ...motion.spring, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(anim, { toValue: 0, ...motion.exit, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
  }, [visible, anim]);

  function handleSortSelect(option) {
    if (!onSort) return;
    // Directionless options (e.g. manual "custom" order) have no asc/desc toggle.
    if (option.directional === false) {
      onSort(option.key);
      onClose();
      return;
    }
    const [currentField, currentDir] = sortOrder.split(':');
    const newDir = currentField === option.key && currentDir === 'desc' ? 'asc' : 'desc';
    onSort(`${option.key}:${newDir}`);
    onClose();
  }

  function handleFilterSelect(filterKey) {
    if (!onFilter) return;
    onFilter(filterKey);
    onClose();
  }

  function handleThumbnailStyleToggle() {
    setThumbnailStyle(thumbnailStyle === 'cover' ? 'contain' : 'cover');
    onClose();
  }

  function getSortDirection(sortKey) {
    if (!sortOrder) return null;
    const [field, dir] = sortOrder.split(':');
    return field === sortKey ? dir : null;
  }

  if (!visible && !isMounted) return null;

  return (
    <Modal visible transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <PopoverSurface
        progress={anim}
        origin="bottom left"
        style={[popupMenuStyles.frame, { bottom, left }]}
        accessibilityRole="menu"
      >
        {!showFilterPanel ? (
          <>
            {sortOptions.map((option) => {
              const dir = getSortDirection(option.key);
              const isDirectionless = option.directional === false;
              const isActive = isDirectionless ? sortOrder === option.key : dir !== null;
              return (
                <MenuRow
                  key={option.key}
                  onPress={() => handleSortSelect(option)}
                  label={option.label}
                  active={isActive}
                  trailing={
                    isActive && !isDirectionless ? (
                      <TrailingIcon name={dir === 'asc' ? 'arrow-up' : 'arrow-down'} color={colors.accent} />
                    ) : undefined
                  }
                />
              );
            })}

            <MenuDivider />

            <MenuRow
              onPress={() => setShowFilterPanel(true)}
              label="Filter"
              trailing={<TrailingIcon name="chevron-right" color={colors.menuTextDim} />}
            />
            {activeFilter.length > 0 && (
              <MenuRow onPress={() => handleFilterSelect('all')} label="Clear filter" icon="close-circle" />
            )}

            {showViewOptions && (
              <>
                <MenuDivider />
                <MenuRow
                  onPress={handleThumbnailStyleToggle}
                  label={thumbnailStyle === 'cover' ? 'Full photo grid' : 'Square photo grid'}
                  icon={thumbnailStyle === 'cover' ? 'expand' : 'grid'}
                />
              </>
            )}
          </>
        ) : (
          <>
            <MenuRow onPress={() => setShowFilterPanel(false)} label="Filter" icon="chevron-left" emphasized />

            <MenuDivider />

            {filterOptions.map((option) => (
              <MenuRow
                key={option.key}
                onPress={() => handleFilterSelect(option.key)}
                label={option.label}
                icon={option.icon}
                active={option.key === 'all' ? activeFilter.length === 0 : activeFilter.includes(option.key)}
              />
            ))}
          </>
        )}
      </PopoverSurface>
    </Modal>
  );
}

function MenuRow({ onPress, ...content }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [popupMenuStyles.row, pressed && styles.rowPressed]}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: !!content.active }}
    >
      <MenuItemContent {...content} />
    </Pressable>
  );
}

function TrailingIcon({ name, color }) {
  return <Icon name={name} size={spacing.menuIconSize} color={color} style={styles.trailingIcon} />;
}

const styles = StyleSheet.create({
  rowPressed: {
    backgroundColor: colors.menuHover,
  },
  trailingIcon: {
    marginLeft: 8,
  },
});
