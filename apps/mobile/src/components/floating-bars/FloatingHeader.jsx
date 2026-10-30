import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountButton from './AccountButton';
import { useFloatingBars } from './FloatingBarsContext';
import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import SelectionActions from '@/features/asset-list/SelectionActions';
import { colors, layout, motion, typography } from '@/styles/designTokens';

// The main screens' header. A screen with select mode passes its `selection`
// (useToggleSelectAssetsAction), the `selectionActions` (useAssetSelectionActions) and `onDelete`.
export default function FloatingHeader({ title, onAdd, selection, selectionActions, onDelete }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scrollY } = useFloatingBars();
  const isSelectMode = selection?.isSelectMode ?? false;

  // ── Animated styles (must be called before any conditional return) ─────────
  const titleStyle = useAnimatedStyle(() => {
    const scrollOpacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP);
    const scrollY_ = interpolate(scrollY.value, [0, 60], [0, -8], Extrapolation.CLAMP);
    return {
      opacity: withTiming(isSelectMode ? 0 : scrollOpacity, motion.move),
      transform: [{ translateY: scrollY_ }, { translateX: withTiming(isSelectMode ? -24 : 0, motion.move) }],
      pointerEvents: isSelectMode ? 'none' : 'auto',
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

  function handleSettings() {
    navigation.navigate('SettingsTab');
  }

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="box-none">
      {/* Page title */}
      <Animated.Text style={[styles.title, titleStyle]}>{title}</Animated.Text>

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
    paddingVertical: 8,
    zIndex: 100,
  },
  title: {
    fontSize: typography.title1,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillWrapper: {
    position: 'absolute',
    right: 0,
  },
});
