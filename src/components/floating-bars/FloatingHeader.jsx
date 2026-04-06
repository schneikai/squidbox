import Icon from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientButton from '@/components/GradientButton';
import { useFloatingBars } from './FloatingBarsContext';
import FloatingPill from './FloatingPill';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, shadows, spacing, typography } from '@/styles/designTokens';
import useCloud from '@/features/cloud/useCloud';

export default function FloatingHeader({
  title,
  isAssetsTab = false,
  onAdd,
  onDownload,
  onAddToAlbum,
  onPost,
  onDelete,
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated } = useCloud();
  const {
    scrollY,
    isSelectMode,
    selectedAssetIds,
    toggleSelectMode,
    exitSelectMode,
  } = useFloatingBars();

  // ── Animated styles (must be called before any conditional return) ─────────
  const titleStyle = useAnimatedStyle(() => {
    const scrollOpacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP);
    const scrollY_ = interpolate(scrollY.value, [0, 60], [0, -8], Extrapolation.CLAMP);
    return {
      opacity: withTiming(isSelectMode ? 0 : scrollOpacity, { duration: 200 }),
      transform: [
        { translateY: scrollY_ },
        { translateX: withTiming(isSelectMode ? -24 : 0, { duration: 200 }) },
      ],
      pointerEvents: isSelectMode ? 'none' : 'auto',
    };
  });

  // Normal controls (avatar + action pill) fade out in select mode
  const normalStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 0 : 1, { duration: 200 }),
    transform: [{ translateX: withTiming(isSelectMode ? 30 : 0, { duration: 200 }) }],
    pointerEvents: isSelectMode ? 'none' : 'auto',
  }));

  // Select pill slides in from right in select mode
  const selectPillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 1 : 0, { duration: 200 }),
    transform: [{ translateX: withTiming(isSelectMode ? 0 : 30, { duration: 200 }) }],
    pointerEvents: isSelectMode ? 'auto' : 'none',
  }));

  const hasSelection = selectedAssetIds.length > 0;

  function handleSettings() { navigation.navigate('SettingsTab'); }

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="box-none">
      {/* Page title */}
      <Animated.Text style={[styles.title, titleStyle]}>{title}</Animated.Text>

      {/* Normal mode: action pill + avatar circle */}
      <Animated.View style={[styles.rightGroup, normalStyle]}>
        {/* Action pill: select toggle + add */}
        <FloatingPill>
          {isAssetsTab && (
            <PillButton iconName="check-circle" onPress={toggleSelectMode} />
          )}
          <GradientButton onPress={onAdd} style={styles.addButton}>
              <Icon name="add" color={colors.textInverse} />
          </GradientButton>
        </FloatingPill>

        {/* Avatar / account bubble — separate, to the right of the action pill */}
        <Pressable
          onPress={handleSettings}
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
        </Pressable>
      </Animated.View>

      {/* Select mode pill (assets only) */}
      {isAssetsTab && (
        <Animated.View style={[styles.pillWrapper, selectPillStyle]}>
          <FloatingPill>
            <PillButton iconName="download" onPress={onDownload} disabled={!hasSelection} />
            <PillButton iconName="library" onPress={onAddToAlbum} disabled={!hasSelection} />
            <PillButton iconName="share" onPress={onPost} disabled={!hasSelection} />
            <PillButton iconName="trash" onPress={onDelete} disabled={!hasSelection} danger />
            <GradientButton onPress={exitSelectMode} style={styles.addButton}>
              <Icon name="close" color={colors.textInverse} />
            </GradientButton>
          </FloatingPill>
        </Animated.View>
      )}
    </View>
  );
}

function PillButton({ iconName, onPress, disabled, danger }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        pressed && { backgroundColor: colors.pressedBg },
        disabled && styles.pillButtonDisabled,
      ]}
    >
      <Icon name={iconName} color={danger ? colors.danger : colors.text} />
    </Pressable>
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
  // ── Pill internals ────────────────────────────────────────────────────────
  addButton: {
    marginLeft: 2,
  },
  pillButtonDisabled: {
    opacity: 0.35,
  },
});
