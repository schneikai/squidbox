import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import ModelCard from './ModelCard';
import TweetRow from './TweetRow';

import Chip from '@/components/Chip';

// Memoized: a vision round settles photo by photo, and a tap changes one key's taps, so only the
// cards whose `results` or `taps` changed re-render.
export default memo(ModelAnswers);

/**
 * Every model's answer for one results key (TEXT_KEY or a photo), on cards in the round's letter
 * order: the tweets with their thumbs up, or the tags to mark as fitting. `toggle(answerKey,
 * modelId, index)` is the round's.
 */
function ModelAnswers({ answerKey, kind, letters, namesById, results = {}, taps = {}, roundNumber, toggle }) {
  return letters.map(({ modelId, label }) => {
    const items = results[modelId]?.items ?? [];
    const tapped = taps[modelId] ?? [];
    return (
      <ModelCard key={`${roundNumber}-${modelId}`} label={label} name={namesById[modelId]} result={results[modelId]}>
        {kind === 'vision' ? (
          <View style={styles.tags}>
            {items.map((tag, index) => {
              const isOn = tapped.includes(index);
              return (
                <Chip
                  key={index}
                  label={tag}
                  variant={isOn ? 'accent' : 'muted'}
                  onPress={() => toggle(answerKey, modelId, index)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn }}
                />
              );
            })}
          </View>
        ) : (
          items.map((tweet, index) => {
            const isLiked = tapped.includes(index);
            return (
              <TweetRow key={index} text={tweet} isLiked={isLiked} onToggle={() => toggle(answerKey, modelId, index)} />
            );
          })
        )}
      </ModelCard>
    );
  });
}

const styles = StyleSheet.create({
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
