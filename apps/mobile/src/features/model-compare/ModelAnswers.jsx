import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import ModelCard from './ModelCard';
import TagChip from './TagChip';
import TweetRow from './TweetRow';

// Memoized: a vision round settles photo by photo, and a tap changes one key's taps, so only the
// cards whose `results` or `taps` changed re-render.
export default memo(ModelAnswers);

/**
 * Every model's answer for one results key (TEXT_KEY or a photo), on cards in the round's letter
 * order: the tweets with their thumbs up, or the tags to mark as fitting. `toggle(answerKey,
 * modelId, index, isOn)` is the round's.
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
                <TagChip key={index} label={tag} isOn={isOn} onToggle={() => toggle(answerKey, modelId, index, isOn)} />
              );
            })}
          </View>
        ) : (
          items.map((tweet, index) => {
            const isLiked = tapped.includes(index);
            return (
              <TweetRow
                key={index}
                text={tweet}
                isLiked={isLiked}
                onToggle={() => toggle(answerKey, modelId, index, isLiked)}
              />
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
