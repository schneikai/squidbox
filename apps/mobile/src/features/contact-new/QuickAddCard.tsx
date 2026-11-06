import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import { colors, disabledOpacity, press, radii, scale, shadows, typography } from '@/styles/designTokens';

const DISC = scale(40);

/**
 * One of New contact's quick adds: a white card with its `icon` in a disc and a `title` under it.
 * `isAssistant` marks the assistant's (the sparkle on the accent's disc); the others' disc is grey.
 * `loading` shows a spinner in the disc and takes no presses.
 */
type QuickAddCardProps = {
  icon: IconName;
  title: string;
  isAssistant?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export default function QuickAddCard({
  icon,
  title,
  isAssistant = false,
  loading = false,
  onPress,
}: QuickAddCardProps) {
  const iconColor = isAssistant ? colors.accent.base : colors.text.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: loading }}
      style={({ pressed }) => [styles.card, pressed && press.filled, loading && styles.busy]}
    >
      <View style={[styles.disc, isAssistant && styles.assistantDisc]}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Icon name={icon} size={scale(20)} color={iconColor} filled={isAssistant} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 10,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: colors.background.surface,
    ...shadows.card,
  },
  busy: {
    opacity: disabledOpacity + 0.3,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantDisc: {
    backgroundColor: colors.accent.light,
  },
  title: {
    fontSize: typography.callout,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
