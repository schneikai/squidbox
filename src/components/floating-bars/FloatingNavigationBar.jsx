import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState, useNavigation } from '@react-navigation/native';

import { useFloatingBars } from './FloatingBarsContext';
import { getActiveTabName, getActiveStackDepth } from './navStateHelpers';
import FloatingPill from './FloatingPill';
import { colors, spacing, shadows } from '@/styles/designTokens';

const NAV_ITEMS = [
  { tab: 'AssetsTab', icon: 'grid-outline', iconActive: 'grid' },
  { tab: 'AlbumsTab', icon: 'folder-outline', iconActive: 'folder' },
  { tab: 'PostsTab', icon: 'share-social-outline', iconActive: 'share-social' },
];

export default function FloatingNavigationBar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { navBarVisible, isSearchActive, isSelectMode, resetScroll } = useFloatingBars();

  const activeTab = useNavigationState((s) => getActiveTabName(s));
  const stackDepth = useNavigationState((s) => getActiveStackDepth(s));
  const isMainScreen = stackDepth === 0;

  const hideBar = isSearchActive || !isMainScreen || isSelectMode;

  const navBarStyle = useAnimatedStyle(() => {
    const scrollHide = interpolate(navBarVisible.value, [0, 1], [100, 0], Extrapolation.CLAMP);
    const contextHide = hideBar ? 100 : 0;
    return {
      transform: [{ translateY: withTiming(Math.max(scrollHide, contextHide), { duration: 250 }) }],
      opacity: withTiming(hideBar ? 0 : 1, { duration: 250 }),
    };
  });

  function handleNavigate(tab) {
    resetScroll();
    navigation.navigate('MainTab', { screen: tab });
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + spacing.floatingBarBottom,
          right: spacing.floatingBarSide,
        },
        navBarStyle,
      ]}
    >
      <FloatingPill>
        {NAV_ITEMS.map(({ tab, icon, iconActive }) => {
          const isActive = activeTab === tab;
          return (
            <NavButton
              key={tab}
              icon={isActive ? iconActive : icon}
              isActive={isActive}
              onPress={() => handleNavigate(tab)}
            />
          );
        })}
      </FloatingPill>
    </Animated.View>
  );
}

function NavButton({ icon, isActive, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && !isActive && styles.buttonPressed]}
    >
      {isActive ? (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, styles.activeGradient]}
        >
          <Ionicons name={icon} size={20} color={colors.iconActive} />
        </LinearGradient>
      ) : (
        <View style={styles.button}>
          <Ionicons name={icon} size={20} color={colors.iconInactive} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: spacing.iconButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  activeGradient: {
    ...shadows.accent,
  },
});
