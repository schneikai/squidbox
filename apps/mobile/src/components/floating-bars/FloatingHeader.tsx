import { useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountButton from './AccountButton';
import FloatingPill from './FloatingPill';
import ToolbarTitle from './ToolbarTitle';

import Button from '@/components/Button';
import SelectionActions, { type SelectionActionsProps } from '@/features/asset-list/SelectionActions';
import type { AssetSelection } from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import { colors, layout, motion, space, textStyles } from '@/styles/designTokens';

// Scroll offsets (pt): the large title is gone by COMPACT_FROM, the small one fully in by COMPACT_TO.
const COMPACT_FROM = 40;
const COMPACT_TO = 64;

export type FloatingHeaderProps = {
  title: string;
  /** The screen's own scroll offset (useFloatingBarScrollHandler): the title fades as it scrolls. */
  scrollY: SharedValue<number>;
  onAdd: () => void;
} & (
  | {
      selection: AssetSelection;
      selectionActions: SelectionActionsProps['actions'];
      onDelete?: SelectionActionsProps['onDelete'];
    }
  | { selection?: undefined; selectionActions?: undefined; onDelete?: undefined }
);

// The main screens' header. `title` is the screen's title. A screen with select mode passes its `selection`
// (useToggleSelectAssetsAction), the `selectionActions` (useAssetSelectionActions) and `onDelete`.
export default function FloatingHeader({
  title,
  scrollY,
  onAdd,
  selection,
  selectionActions,
  onDelete,
}: FloatingHeaderProps) {
  const insets = useSafeAreaInsets();
  // Typed routes are off, so the tab's name goes untyped.
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isSelectMode = selection?.isSelectMode ?? false;

  // ── Animated styles (must be called before any conditional return) ─────────
  // As the list scrolls, the large title gives way to a small one in a pill (ToolbarTitle), so the tab
  // keeps its name on screen over the content (HIG, Toolbars: a large title turns into a standard one).
  const titleStyle = useAnimatedStyle(() => {
    const scrollOpacity = interpolate(scrollY.value, [0, COMPACT_FROM], [1, 0], Extrapolation.CLAMP);
    const scrollY_ = interpolate(scrollY.value, [0, COMPACT_FROM], [0, -8], Extrapolation.CLAMP);
    return {
      opacity: withTiming(isSelectMode ? 0 : scrollOpacity, motion.move),
      transform: [{ translateY: scrollY_ }, { translateX: withTiming(isSelectMode ? -24 : 0, motion.move) }],
      pointerEvents: isSelectMode ? 'none' : 'auto',
    };
  });

  const compactTitleStyle = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [COMPACT_FROM, COMPACT_TO], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: isSelectMode ? withTiming(0, motion.move) : progress,
      transform: [{ scale: interpolate(progress, [0, 1], [0.9, 1]) }],
    };
  });

  // Normal controls (action pill + account) fade out in select mode
  const normalStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 0 : 1, motion.move),
    transform: [{ translateX: withTiming(isSelectMode ? 30 : 0, motion.move) }],
    pointerEvents: isSelectMode ? 'none' : 'auto',
  }));

  // Select pill slides in from right in select mode
  const selectPillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 1 : 0, motion.move),
    transform: [{ translateX: withTiming(isSelectMode ? 0 : 30, motion.move) }],
    pointerEvents: isSelectMode ? 'auto' : 'none',
  }));

  // To the Settings tab as it was left (`router.navigate('/settings')` would pop to its first screen).
  function handleSettings() {
    navigation.navigate('settings');
  }

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="box-none">
      {/* Page title */}
      <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
        {title}
      </Animated.Text>

      {/* Small title, once the list is scrolled */}
      <Animated.View
        style={[styles.compactTitle, compactTitleStyle]}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <ToolbarTitle title={title} />
      </Animated.View>

      {/* Normal mode: action pill + account */}
      <Animated.View style={[styles.rightGroup, normalStyle]}>
        <FloatingPill>
          {selection && <Button icon="check-circle" onPress={selection.toggleSelectMode} accessibilityLabel="Select" />}
          <Button variant="primary" icon="add" onPress={onAdd} accessibilityLabel="Add" />
        </FloatingPill>
        <AccountButton onPress={handleSettings} />
      </Animated.View>

      {/* Select mode pill */}
      {selection && (
        <Animated.View style={[styles.pillWrapper, selectPillStyle]}>
          <FloatingPill>
            <SelectionActions actions={selectionActions} onDelete={onDelete} onClose={selection.exitSelectMode} />
          </FloatingPill>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    zIndex: 100,
  },
  title: {
    ...textStyles.title1,
    color: colors.text.primary,
    flex: 1,
  },
  compactTitle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pillWrapper: {
    position: 'absolute',
    right: 0,
  },
});
