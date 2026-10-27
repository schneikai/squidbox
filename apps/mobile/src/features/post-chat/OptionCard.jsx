import * as Clipboard from 'expo-clipboard';
import { Alert, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import IconMenuButton from '@/components/IconMenuButton';
import TextButton from '@/components/TextButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import { colors, lineHeights, typography } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { addFavorites, removeFavorite } from '@/sync/favoritesRepository';
import { requestSync } from '@/sync/worker';

/**
 * One post the assistant wrote: its text, a heart that adds it to Favorites (from `source`, or takes
 * it out again: `favoriteId` is the favorite with this text, if any), ⋯ → More like this
 * (`onMoreLikeThis(text)`), and Use (`onUse(text)`, when given) or else Copy.
 */
export default function OptionCard({ text, source, favoriteId, onMoreLikeThis, onUse }) {
  const haptics = useHaptics();

  async function handleHeart() {
    haptics.selection();
    try {
      if (favoriteId) await removeFavorite(getDb(), favoriteId);
      else await addFavorites(getDb(), [text], source);
      requestSync();
    } catch (error) {
      console.error('Changing the favorite failed', error);
      Alert.alert("Couldn't change Favorites", error.message);
    }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(text);
    haptics.success();
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.text} selectable>
        {text}
      </Text>
      <View style={styles.actions}>
        <IconButton
          icon="heart"
          filled={Boolean(favoriteId)}
          color={favoriteId ? colors.status.danger : colors.text.secondary}
          onPress={handleHeart}
          accessibilityLabel={favoriteId ? 'Remove from favorites' : 'Add to favorites'}
        />
        <IconMenuButton color={colors.text.secondary} accessibilityLabel="More for this option">
          <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(text)} />
        </IconMenuButton>
        <View style={styles.action}>
          {onUse ? (
            <TextButton label="Use" size="small" onPress={() => onUse(text)} />
          ) : (
            <TextButton label="Copy" icon="copy" size="small" onPress={handleCopy} />
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 4,
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
