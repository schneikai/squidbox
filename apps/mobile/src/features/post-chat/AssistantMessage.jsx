import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AssistantBubble from './AssistantBubble';

import Card from '@/components/Card';
import OptionCard from '@/components/OptionCard';
import TextButton from '@/components/TextButton';
import { colors, typography } from '@/styles/designTokens';

// A reasoning model's first drafting turn can take a while: after this, the card says it still works.
const SLOW_MS = 20_000;

/**
 * One of the assistant's replies (`reply`, a chat message): a spinner while it's written, what went
 * wrong with Retry (`onRetry`, for the last reply only), or what it says (AssistantBubble) and its
 * options for the post as OptionCards, hearted through `favorites` (useFavoriteToggle's) from
 * `source`, Favorites' name for where they came from.
 */
function AssistantMessage({ reply, source, favorites, onRetry, onMoreLikeThis, onUse }) {
  if (reply.status === 'loading') return <ThinkingCard />;

  if (reply.status === 'error') {
    return (
      <Card style={styles.status}>
        <Text style={styles.statusText}>{reply.error}</Text>
        {onRetry && <TextButton label="Retry" size="small" onPress={onRetry} />}
      </Card>
    );
  }

  return (
    <View style={styles.reply}>
      {!!reply.reply && <AssistantBubble text={reply.reply} />}
      {reply.postOptions.map((text, index) => (
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

export default memo(AssistantMessage);

// "Thinking…", and "Still writing…" once it takes longer than SLOW_MS.
function ThinkingCard() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card style={styles.status}>
      <ActivityIndicator color={colors.text.secondary} />
      <Text style={styles.statusText}>{isSlow ? 'Still writing…' : 'Thinking…'}</Text>
    </Card>
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
  reply: {
    gap: 10,
  },
});
