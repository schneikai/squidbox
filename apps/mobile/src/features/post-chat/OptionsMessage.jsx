import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import OptionCard from './OptionCard';

import Card from '@/components/Card';
import TextButton from '@/components/TextButton';
import { colors, typography } from '@/styles/designTokens';

/**
 * One of the assistant's replies (`reply`, a chat message): a spinner while it's written, what went
 * wrong with Retry (`onRetry`, for the last reply only), or its posts as OptionCards. A post's
 * favorite is `favoriteIdByText`'s; `source` names where it came from in Favorites.
 */
export default function OptionsMessage({ reply, source, favoriteIdByText, onRetry, onMoreLikeThis, onUse }) {
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
          source={source}
          favoriteId={favoriteIdByText.get(text.trim())}
          onMoreLikeThis={onMoreLikeThis}
          onUse={onUse}
        />
      ))}
    </View>
  );
}

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
