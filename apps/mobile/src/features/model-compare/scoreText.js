import pluralizeText from '@/utils/pluralizeText';

/**
 * A model's score in its list: thumbs up for writing ("9"), tags that fit for vision ("34 tags
 * fit"), from 0 once it was compared; "Not tried yet" (score null) before.
 */
export default function scoreText(score, kind) {
  if (score === null) return 'Not tried yet';
  if (kind === 'vision') return pluralizeText('%{count} tag fits', '%{count} tags fit', score);
  return String(score);
}
