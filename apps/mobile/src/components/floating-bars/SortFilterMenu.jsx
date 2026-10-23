import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { colors, sizes } from '@/styles/designTokens';

/**
 * The rows of the sort / filter / view-options menu, for a MenuButton. "Filter" drills down into a
 * filter panel inside the same menu; the menu reopens at the root.
 *
 * Props:
 *   sortOrder       – string  the active option's key, e.g. "createdAt:desc"
 *   sortOptions     – [{ key, label }], one row per order (Newest first, Oldest first…); none for a fixed order
 *   activeFilter    – string[]
 *   filterOptions   – [{ key, label, icon }]
 *   onSort          – (sortOrder: string) => void
 *   onFilter        – (filterKey: string) => void
 *   showViewOptions – boolean
 */
export default function SortFilterMenu({
  sortOrder,
  sortOptions,
  activeFilter = [],
  filterOptions = [],
  onSort,
  onFilter,
  showViewOptions = false,
}) {
  const { thumbnailStyle, setThumbnailStyle } = useAppSettings();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Returning false keeps the menu open while it switches panels.
  function showPanel(isFilter) {
    setShowFilterPanel(isFilter);
    return false;
  }

  if (showFilterPanel) {
    return (
      <>
        <MenuOption onPress={() => showPanel(false)} label="Filter" icon="chevron-left" emphasized />
        <MenuDivider />
        {filterOptions.map((option) => (
          <MenuOption
            key={option.key}
            onPress={() => {
              onFilter?.(option.key);
            }}
            label={option.label}
            icon={option.icon}
            active={option.key === 'all' ? activeFilter.length === 0 : activeFilter.includes(option.key)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {sortOptions.map((option) => (
        <MenuOption
          key={option.key}
          onPress={() => onSort?.(option.key)}
          label={option.label}
          active={sortOrder === option.key}
        />
      ))}

      {sortOptions.length > 0 && <MenuDivider />}

      <MenuOption
        onPress={() => showPanel(true)}
        label="Filter"
        trailing={
          <Icon name="chevron-right" size={sizes.menuIcon} color={colors.text.secondary} style={styles.chevron} />
        }
      />
      {activeFilter.length > 0 && (
        <MenuOption onPress={() => {
            onFilter?.('all');
          }} label="Clear filter" icon="close-circle" />
      )}

      {showViewOptions && (
        <>
          <MenuDivider />
          <MenuOption
            onPress={() => {
              setThumbnailStyle(thumbnailStyle === 'cover' ? 'contain' : 'cover');
            }}
            label={thumbnailStyle === 'cover' ? 'Full photo grid' : 'Square photo grid'}
            icon={thumbnailStyle === 'cover' ? 'expand' : 'grid'}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chevron: {
    marginLeft: 8,
  },
});
