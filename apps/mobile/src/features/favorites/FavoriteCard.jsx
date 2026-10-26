import { Pressable, StyleSheet, Text } from 'react-native';

import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import { colors, lineHeights, typography } from '@/styles/designTokens';
import relativeTime from '@/utils/relativeTime';

/**
 * One favorite: its text, where it came from (a prompt button's name, or "Your post") and when, and
 * a filled heart. A tap opens it (`onOpen(favorite)`), the heart unhearts it (`onUnheart(favorite)`).
 * `isRemoved`: unhearted and waiting for its Undo, dimmed, the heart an outline that hearts it again
 * (`onUndo()`).
 */
export default function FavoriteCard({ favorite, isRemoved, onOpen, onUnheart, onUndo }) {
  const meta = `${favorite.source ?? 'Your post'} · ${relativeTime(favorite.createdAt)}`;

  return (
    <Card style={[styles.card, isRemoved && styles.removed]}>
      <Pressable
        onPress={() => onOpen(favorite)}
        disabled={isRemoved}
        accessibilityRole="button"
        accessibilityHint="Opens it to edit"
        style={({ pressed }) => [styles.texts, pressed && styles.pressed]}
      >
        <Text style={styles.text}>{favorite.text}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </Pressable>
      <IconButton
        icon="heart"
        filled={!isRemoved}
        color={isRemoved ? colors.text.tertiary : colors.status.danger}
        onPress={isRemoved ? onUndo : () => onUnheart(favorite)}
        accessibilityLabel={isRemoved ? 'Add back to favorites' : 'Remove from favorites'}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 6,
    paddingTop: 4,
  },
  texts: {
    flex: 1,
    gap: 6,
    paddingLeft: 20,
    paddingVertical: 14,
  },
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  meta: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  pressed: {
    opacity: 0.6,
  },
  removed: {
    opacity: 0.45,
  },
});
