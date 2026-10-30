import { memo } from 'react';

import ModelCard from './ModelCard';
import TweetRow from './TweetRow';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import IntroText from '@/components/IntroText';

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
    const levels = taps[modelId] ?? {};
    return (
      <ModelCard
        key={`${roundNumber}-${modelId}`}
        modelId={modelId}
        label={label}
        name={namesById[modelId]}
        result={results[modelId]}
      >
        {kind === 'vision' && items.length === 0 ? (
          <IntroText>Only tags from earlier rounds</IntroText>
        ) : kind === 'vision' ? (
          <ChipRow>
            {items.map((tag, index) => {
              const isOn = (levels[index] ?? 0) > 0;
              return (
                <Chip
                  key={index}
                  label={tag}
                  isSelected={isOn}
                  onPress={() => toggle(answerKey, modelId, index)}
                  accessibilityRole="checkbox"
                />
              );
            })}
          </ChipRow>
        ) : (
          items.map((tweet, index) => {
            return (
              <TweetRow
                key={index}
                text={tweet}
                level={levels[index] ?? 0}
                onToggle={() => toggle(answerKey, modelId, index)}
              />
            );
          })
        )}
      </ModelCard>
    );
  });
}
