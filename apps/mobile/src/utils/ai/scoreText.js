import pluralizeText from '@/utils/pluralizeText';

/**
 * A model's score in words, for a screen reader beside the grey line's thumbs-up icon (ScoreDetail):
 * thumbs up for writing ("9 thumbs up"), tags that fit for vision ("34 tags fit").
 */
export default function scoreText(score, kind) {
  if (kind === 'vision') return pluralizeText('%{count} tag fits', '%{count} tags fit', score);
  return pluralizeText('%{count} thumb up', '%{count} thumbs up', score);
}
