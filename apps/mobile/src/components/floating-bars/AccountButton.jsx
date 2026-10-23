import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import useCloud from '@/features/cloud/useCloud';
import { colors, scale, shadows, spacing, typography } from '@/styles/designTokens';

const SIZE = scale(34);
// Brings the tap target to the 44pt minimum.
const HIT_SLOP = (spacing.iconButtonSize - SIZE) / 2;

/**
 * The account avatar at the far right of the main header, outside any toolbar: it stands for the
 * user, not for an action. Shows the account's initial while signed in, a person when signed out,
 * and a red dot when the session ended and a sign-in is needed before anything syncs.
 */
export default function AccountButton({ onPress }) {
  const { user, isAuthenticated, needsReauth } = useCloud();
  const initial = (isAuthenticated || needsReauth) && user?.email ? user.email.charAt(0).toUpperCase() : null;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      style={({ pressed }) => [styles.avatar, !initial && styles.signedOut, pressed && styles.pressed]}
    >
      {initial ? (
        <Text style={styles.initial}>{initial}</Text>
      ) : (
        <Icon name="user" size={spacing.iconSizeSmall} color={colors.textSecondary} />
      )}
      {needsReauth && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  signedOut: {
    backgroundColor: colors.mutedSurface,
  },
  pressed: {
    opacity: 0.7,
  },
  initial: {
    color: colors.accent,
    fontSize: typography.subheadline,
    fontWeight: '700',
  },
  badge: {
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
});
