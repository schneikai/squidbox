import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { colors, sizes } from '@/styles/designTokens';

const DEFAULT_SORT_OPTIONS = [
  { key: 'createdAt', label: 'Created At' },
  { key: 'lastPostedAt', label: 'Last Posted At' },
];

/**
 * The rows of the sort / filter / view-options menu, for a MenuButton. "Filter" drills down into a
 * filter panel inside the same menu; the menu reopens at the root.
 *
 * Props:
 *   sortOrder       – string  e.g. "createdAt:desc"
 *   sortOptions     – [{ key, label, directional? }]
 *   activeFilter    – string[]
 *   filterOptions   – [{ key, label, icon }]
 *   onSort          – (sortOrder: string) => void
 *   onFilter        – (filterKey: string) => void
 *   showViewOptions – boolean
 */
export default function SortFilterMenu({
  sortOrder = 'createdAt:desc',
  sortOptions = DEFAULT_SORT_OPTIONS,
  activeFilter = [],
  filterOptions = [],
  onSort,
  onFilter,
  showViewOptions = false,
}) {
  const { thumbnailStyle, setThumbnailStyle } = useAppSettings();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortField, sortDir] = sortOrder?.split(':') ?? [];

  function handleSortSelect(option) {
    // Directionless options (e.g. manual "custom" order) have no asc/desc toggle.
    if (option.directional === false) {
      onSort?.(option.key);
      return;
    }
    const newDir = sortField === option.key && sortDir === 'desc' ? 'asc' : 'desc';
    onSort?.(`${option.key}:${newDir}`);
  }

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
      {sortOptions.map((option) => {
        const dir = sortField === option.key ? sortDir : null;
        const isDirectionless = option.directional === false;
        const isActive = isDirectionless ? sortOrder === option.key : dir !== null;
        return (
          <MenuOption
            key={option.key}
            onPress={() => handleSortSelect(option)}
            label={option.label}
            active={isActive}
            trailing={
              isActive && !isDirectionless ? (
                <TrailingIcon name={dir === 'asc' ? 'arrow-up' : 'arrow-down'} color={colors.accent.base} />
              ) : undefined
            }
          />
        );
      })}

      <MenuDivider />

      <MenuOption
        onPress={() => showPanel(true)}
        label="Filter"
        trailing={<TrailingIcon name="chevron-right" color={colors.text.secondary} />}
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

function TrailingIcon({ name, color }) {
  return <Icon name={name} size={sizes.menuIcon} color={color} style={styles.trailingIcon} />;
}

const styles = StyleSheet.create({
  trailingIcon: {
    marginLeft: 8,
  },
});
