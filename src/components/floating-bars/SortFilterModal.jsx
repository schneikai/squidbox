// Popover menu system 2 of 2 — fixed-position multi-panel sort/filter modal.
// Uses React Native's Modal with absolute bottom/left coordinates (not anchored
// to a trigger). Supports a two-panel drill-down: sort options at root, filter
// options in a sub-panel with a back button.
//
// TODO: Consider unifying with PopupMenu/BlurPopoverRenderer into a single system.
// Would require adding sub-panel navigation support to the popup-menu renderer.
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import useAppSettings from '@/features/app-settings/useAppSettings';
import popupMenuStyles from '@/styles/popupMenuStyles';
import { colors, radii, shadows, spacing } from '@/styles/designTokens';

const DEFAULT_SORT_OPTIONS = [
  { key: 'createdAt', label: 'Created At' },
  { key: 'lastPostedAt', label: 'Last Posted At' },
];

/**
 * Reusable sort / filter / view-options modal panel.
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
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 130,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  function handleClose() {
    setShowFilterPanel(false);
    onClose();
  }

  function handleSortSelect(sortKey) {
    if (!onSort) return;
    const [currentField, currentDir] = sortOrder.split(':');
    const newDir = currentField === sortKey && currentDir === 'desc' ? 'asc' : 'desc';
    onSort(`${sortKey}:${newDir}`);
    handleClose();
  }

  function handleFilterSelect(filterKey) {
    if (!onFilter) return;
    onFilter(filterKey);
    handleClose();
  }

  function handleThumbnailStyleToggle() {
    setThumbnailStyle(thumbnailStyle === 'cover' ? 'contain' : 'cover');
    handleClose();
  }

  function getSortDirection(sortKey) {
    if (!sortOrder) return null;
    const [field, dir] = sortOrder.split(':');
    return field === sortKey ? dir : null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      {/* Popover */}
      <Animated.View
        style={[
          styles.popover,
          {
            bottom,
            left,
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
          },
        ]}
      >
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />

        {!showFilterPanel ? (
          // ── Root panel ──────────────────────────────────────────────────────
          <>
            {sortOptions.map((option) => {
              const dir = getSortDirection(option.key);
              const isActive = dir !== null;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => handleSortSelect(option.key)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={styles.rowLabel}>{option.label}</Text>
                  {isActive && (
                    <Ionicons
                      name={dir === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={spacing.menuIconSize}
                      color={colors.accent}
                      style={styles.rowIcon}
                    />
                  )}
                </Pressable>
              );
            })}

            <View style={styles.divider} />

            <Pressable
              onPress={() => setShowFilterPanel(true)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowLabel}>Filter</Text>
              <Ionicons
                name="chevron-forward"
                size={spacing.menuIconSize}
                color={colors.darkModalTextDim}
                style={styles.rowIcon}
              />
            </Pressable>

            {/* Clear filter shortcut */}
            {activeFilter.length > 0 && (
              <Pressable
                onPress={() => handleFilterSelect('all')}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={spacing.menuIconSize}
                  color={colors.darkModalTextDim}
                  style={styles.rowLeadIcon}
                />
                <Text style={styles.rowLabel}>Clear filter</Text>
              </Pressable>
            )}

            {/* View options — thumbnail style toggle */}
            {showViewOptions && (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={handleThumbnailStyleToggle}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Ionicons
                    name={thumbnailStyle === 'cover' ? 'expand-outline' : 'grid-outline'}
                    size={spacing.menuIconSize}
                    color={colors.darkModalTextDim}
                    style={styles.rowLeadIcon}
                  />
                  <Text style={styles.rowLabel}>
                    {thumbnailStyle === 'cover' ? 'Full image grid' : 'Square image grid'}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          // ── Filter panel ────────────────────────────────────────────────────
          <>
            <Pressable
              onPress={() => setShowFilterPanel(false)}
              style={({ pressed }) => [styles.row, styles.backRow, pressed && styles.rowPressed]}
            >
              <Ionicons name="chevron-back" size={spacing.menuIconSize} color={colors.darkModalTextDim} />
              <Text style={[styles.rowLabel, styles.backLabel]}>Filter</Text>
            </Pressable>

            <View style={styles.divider} />

            {filterOptions.map((option) => {
              const isActive =
                option.key === 'all'
                  ? activeFilter.length === 0
                  : activeFilter.includes(option.key);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => handleFilterSelect(option.key)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Ionicons
                    name={option.icon}
                    size={spacing.menuIconSize}
                    color={colors.darkModalTextDim}
                    style={styles.rowLeadIcon}
                  />
                  <Text style={styles.rowLabel}>{option.label}</Text>
                  {isActive && <View style={popupMenuStyles.activeDot} />}
                </Pressable>
              );
            })}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    width: 220,
    borderRadius: radii.modal,
    borderWidth: 1,
    borderColor: colors.darkModalBorder,
    paddingVertical: spacing.barPaddingY,
    overflow: 'hidden',
    ...shadows.floating,
  },
  overlay: {
    backgroundColor: colors.darkModalOverlay,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.menuRowH,
    paddingVertical: spacing.menuRowV,
  },
  rowPressed: {
    backgroundColor: colors.darkModalHover,
  },
  rowLabel: {
    flex: 1,
    fontSize: spacing.menuFontSize,
    color: colors.darkModalText,
  },
  rowIcon: {
    marginLeft: 8,
  },
  rowLeadIcon: {
    marginRight: 10,
  },
  backRow: {
    gap: 6,
  },
  backLabel: {
    fontWeight: '600',
    flex: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.darkModalBorder,
    marginVertical: 4,
    marginHorizontal: 10,
  },
});
