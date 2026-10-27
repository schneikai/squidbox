import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import OptionCard from './OptionCard';

import Card from '@/components/Card';
import TextButton from '@/components/TextButton';
import { colors, typography } from '@/styles/designTokens';

/**
 * One of the assistant's replies (`reply`, a chat message): a spinner while it's written, what went
 * wrong with Retry (`onRetry`, for the last reply only), or its posts as OptionCards, hearted through
 * `favorites` (useFavoriteToggle's) from `source`, Favorites' name for where they came from.
 */
function OptionsMessage({ reply, source, favorites, onRetry, onMoreLikeThis, onUse }) {
  if (reply.status === 'loading') {
    return (
      <Card style={styles.status}>
        <ActivityIndicator color={colors.text.secondary} />
        <Text style={styles.statusText}>Writing…</Text>
      </Card>
    );
  }

  if (reply.status === 'error') {
    return (
      <Card style={styles.status}>
        <Text style={styles.statusText}>{reply.error}</Text>
        {onRetry && <TextButton label="Retry" size="small" onPress={onRetry} />}
      </Card>
    );
  }

  return (
    <View style={styles.options}>
      {reply.tweets.map((text, index) => (
        <OptionCard
          key={`${index}:${text}`}
          text={text}
          isFavorite={Boolean(favorites.favoriteIdOf(text))}
          source={source}
          onToggleFavorite={favorites.toggle}
          onMoreLikeThis={onMoreLikeThis}
          onUse={onUse}
        />
      ))}
    </View>
  );
}

export default memo(OptionsMessage);

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statusText: {
    flex: 1,
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
  options: {
    gap: 10,
  },
});
