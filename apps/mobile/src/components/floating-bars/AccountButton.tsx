import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import useUpdateRequired from '@/hooks/useUpdateRequired';
import useCloud from '@/providers/cloud/useCloud';
import { colors, radii, scale, shadows, sizes, textStyles } from '@/styles/designTokens';

const SIZE = scale(34);
// Brings the tap target to the 44pt minimum.
const HIT_SLOP = (sizes.iconButton - SIZE) / 2;

export type AccountButtonProps = { onPress: () => void };

/**
 * The account avatar at the far right of the main header, outside any toolbar: it stands for the
 * user, not for an action. Shows the account's initial while signed in, a person when signed out,
 * and a red dot when something is needed before anything syncs: a sign-in (the session ended) or an
 * update (the server refused this build as too old, useUpdateRequired).
 */
export default function AccountButton({ onPress }: AccountButtonProps) {
  const { user, isAuthenticated, needsReauth } = useCloud();
  const updateRequired = useUpdateRequired();
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
        <Icon name="user" size={sizes.iconSmall} color={colors.text.secondary} />
      )}
      {(needsReauth || updateRequired) && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  signedOut: {
    backgroundColor: colors.background.muted,
  },
  pressed: {
    opacity: 0.7,
  },
  initial: {
    color: colors.accent.base,
    ...textStyles.subheadlineBold,
  },
  badge: {
    position: 'absolute',
    // eslint-disable-next-line no-restricted-syntax -- a hair over the avatar's edge, like an app icon's badge
    top: -1,
    // eslint-disable-next-line no-restricted-syntax -- as above
    right: -1,
    width: 12,
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.status.danger,
    borderWidth: 2,
    borderColor: colors.text.inverse,
  },
});
