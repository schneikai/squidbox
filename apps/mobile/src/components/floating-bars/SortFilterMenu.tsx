import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Divider from '@/components/Divider';
import Icon, { type IconName } from '@/components/Icon';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAppSettings from '@/providers/app-settings/useAppSettings';
import { colors, sizes, space } from '@/styles/designTokens';

// `Sort` is the screen's sort orders and `Filter` its filters, so an option's key is checked against
// them; a filter menu's 'all' clears the filters.
export type SortOption<Sort extends string = string> = { key: Sort; label: string };
export type FilterOption<Filter extends string = string> = SortOption<Filter | 'all'> & { icon?: IconName };

export type SortFilterMenuProps<Sort extends string, Filter extends string = string> = {
  sortOrder?: Sort;
  sortOptions: SortOption<Sort>[];
  activeFilter?: Filter[];
  filterOptions?: FilterOption<Filter>[];
  onSort?: (key: Sort) => void;
  onFilter?: (key: Filter | 'all') => void;
  showViewOptions?: boolean;
};

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
export default function SortFilterMenu<Sort extends string, Filter extends string = string>({
  sortOrder,
  sortOptions,
  activeFilter = [],
  filterOptions = [],
  onSort,
  onFilter,
  showViewOptions = false,
}: SortFilterMenuProps<Sort, Filter>) {
  const { thumbnailStyle, setThumbnailStyle } = useAppSettings();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const hasFilter = filterOptions.length > 0;

  // Returning false keeps the menu open while it switches panels.
  function showPanel(isFilter: boolean) {
    setShowFilterPanel(isFilter);
    return false;
  }

  if (showFilterPanel) {
    return (
      <>
        <MenuOption onPress={() => showPanel(false)} label="Filter" icon="chevron-left" isHeader />
        <Divider variant="menu" />
        {filterOptions.map((option) => (
          <MenuOption
            key={option.key}
            onPress={() => {
              onFilter?.(option.key);
            }}
            label={option.label}
            icon={option.icon}
            isSelected={option.key === 'all' ? activeFilter.length === 0 : activeFilter.includes(option.key)}
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
          isSelected={sortOrder === option.key}
        />
      ))}

      {hasFilter && (
        <>
          {sortOptions.length > 0 && <Divider variant="menu" />}
          <MenuOption
            onPress={() => showPanel(true)}
            label="Filter"
            trailing={
              <Icon name="chevron-right" size={sizes.menuIcon} color={colors.text.secondary} style={styles.chevron} />
            }
          />
        </>
      )}
      {activeFilter.length > 0 && (
        <MenuOption
          onPress={() => {
            onFilter?.('all');
          }}
          label="Clear filter"
          icon="close-circle"
        />
      )}

      {showViewOptions && (
        <>
          <Divider variant="menu" />
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
    marginLeft: space.sm,
  },
});
