import pluralizeText from '@/utils/pluralizeText';

/**
 * What a screen reader says for a model's grey line (ScoreDetail) while it shows a score: "9 thumbs
 * up · reasons · 0.04¢ a reply", for either kind; undefined otherwise, so the line reads as it shows.
 */
export default function scoreDetailLabel(score, detail) {
  if (!(score > 0)) return undefined;
  return `${pluralizeText('%{count} thumb up', '%{count} thumbs up', score)} · ${detail}`;
}
