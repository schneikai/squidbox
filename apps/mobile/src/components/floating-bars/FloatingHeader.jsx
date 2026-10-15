import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import FloatingPill from './FloatingPill';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import SelectionActions from '@/features/asset-list/SelectionActions';
import useCloud from '@/features/cloud/useCloud';
import { colors, motion, shadows, spacing, typography } from '@/styles/designTokens';

// The main screens' header. A screen with select mode passes its `selection`
// (useToggleSelectAssetsAction), the `selectionActions` (useAssetSelectionActions) and `onDelete`.
export default function FloatingHeader({ title, onAdd, selection, selectionActions, onDelete }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated, needsReauth } = useCloud();
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

  // Normal controls (avatar + action pill) fade out in select mode
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

      {/* Normal mode: action pill + avatar circle */}
      <Animated.View style={[styles.rightGroup, normalStyle]}>
        {/* Action pill: select toggle + add */}
        <FloatingPill>
          {selection && <IconButton icon="check-circle" onPress={selection.toggleSelectMode} />}
          <GradientButton onPress={onAdd} style={styles.addButton} accessibilityLabel="Add">
            <Icon name="add" color={colors.textInverse} />
          </GradientButton>
        </FloatingPill>

        {/* Avatar / account bubble — separate, to the right of the action pill */}
        <Pressable
          onPress={handleSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}
        >
          {isAuthenticated ? (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Icon name="user" size={spacing.iconSizeSmall} color={colors.textInverse} />
            </LinearGradient>
          ) : (
            <View style={styles.avatarFallback}>
              <Icon name="user" size={spacing.iconSizeSmall} color={colors.textSecondary} />
            </View>
          )}
          {/* The session ended: a sign-in is needed before anything syncs */}
          {needsReauth && <View style={styles.avatarBadge} />}
        </Pressable>
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

const AVATAR_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.floatingBarSide,
    right: spacing.floatingBarSide,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    zIndex: 100,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillWrapper: {
    position: 'absolute',
    right: 0,
  },

  // ── Avatar / account bubble ──────────────────────────────────────────────
  avatarButton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    ...shadows.floating,
  },
  avatarPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.93 }],
  },
  avatarGradient: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.glassSurface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.textInverse,
  },
  // ── Pill internals ────────────────────────────────────────────────────────
  addButton: {
    marginLeft: 2,
  },
});
