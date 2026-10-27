import { Pressable, StyleSheet, Text } from 'react-native';

import FavoriteHeartButton from './FavoriteHeartButton';

import Card from '@/components/Card';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/**
 * One favorite: its text and a filled heart. A tap opens it (`onOpen(favorite)`), the heart unhearts it (`onUnheart(favorite)`).
 * `isRemoved`: unhearted and waiting for its Undo, dimmed, the heart an outline that hearts it again
 * (`onUndo()`).
 */
export default function FavoriteCard({ favorite, isRemoved, onOpen, onUnheart, onUndo }) {
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
      </Pressable>
      <FavoriteHeartButton isFavorite={!isRemoved} onPress={isRemoved ? onUndo : () => onUnheart(favorite)} />
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
    paddingLeft: 20,
    paddingVertical: 14,
  },
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  removed: {
    opacity: 0.45,
  },
});
