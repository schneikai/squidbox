import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import IconMenuButton from '@/components/IconMenuButton';
import TextButton from '@/components/TextButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import FavoriteHeartButton from '@/features/favorites/FavoriteHeartButton';
import useCopyText from '@/features/post-chat/useCopyText';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/**
 * One post the assistant wrote: its text and, in the chat (`onToggleFavorite` and `onMoreLikeThis`
 * given), a heart (`isFavorite`; `onToggleFavorite(text, source)`), ⋯ → More like this
 * (`onMoreLikeThis(text)`), and Use (`onUse(text)`, when given) or else Copy. Without them the
 * text alone (a reply Verify shows).
 */
function OptionCard({ text, source, isFavorite, onToggleFavorite, onMoreLikeThis, onUse }) {
  const copy = useCopyText();
  const hasActions = !!onToggleFavorite && !!onMoreLikeThis;

  return (
    <Card style={[styles.card, !hasActions && styles.textOnly]}>
      <Text style={styles.text} selectable>
        {text}
      </Text>
      {hasActions && (
        <View style={styles.actions}>
          <FavoriteHeartButton isFavorite={isFavorite} onPress={() => onToggleFavorite(text, source)} />
          <IconMenuButton color={colors.text.secondary} accessibilityLabel="More for this option">
            <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(text)} />
          </IconMenuButton>
          <View style={styles.action}>
            {onUse ? (
              <TextButton label="Use" size="small" onPress={() => onUse(text)} />
            ) : (
              <TextButton label="Copy" icon="copy" size="small" onPress={() => copy(text)} />
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

export default memo(OptionCard);

const styles = StyleSheet.create({
  card: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 4,
  },
  textOnly: {
    paddingBottom: 14,
  },
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -10,
  },
  action: {
    marginLeft: 'auto',
  },
});
