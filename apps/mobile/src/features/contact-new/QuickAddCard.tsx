import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import Text from '@/components/Text';
import { colors, disabledOpacity, layout, press, radii, scale, shadows } from '@/styles/designTokens';

const DISC = scale(40);
const BADGE = scale(14);

/**
 * One of New contact's quick adds, all the assistant's: a white card with its `icon` on the accent's
 * disc, the filled sparkle as a badge on the disc's bottom right, and a `title` under it.
 * `loading` shows a spinner in the disc and takes no presses.
 */
type QuickAddCardProps = {
  icon: IconName;
  title: string;
  loading?: boolean;
  onPress: () => void;
};

export default function QuickAddCard({ icon, title, loading = false, onPress }: QuickAddCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: loading }}
      style={({ pressed }) => [styles.card, shadows.card, pressed && press.filled, loading && styles.busy]}
    >
      <View style={styles.disc}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent.base} />
        ) : (
          <Icon name={icon} size={scale(20)} color={colors.accent.base} />
        )}
        <Icon name="sparkle" size={BADGE} color={colors.accent.base} filled style={styles.badge} />
      </View>
      <Text variant="title" size="small">
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    // A padded Card's.
    gap: layout.cardGap,
    padding: layout.cardInset,
    borderRadius: radii.card,
    backgroundColor: colors.background.surface,
  },
  busy: {
    opacity: disabledOpacity + 0.3,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // On the disc's edge, in its corner.
  badge: {
    position: 'absolute',
    // eslint-disable-next-line no-restricted-syntax -- a hair over the disc's edge, like the account button's badge
    right: -scale(1),
    // eslint-disable-next-line no-restricted-syntax -- as above
    bottom: -scale(1),
  },
});
