import formatCost from '@/utils/ai/formatCost';
import reasoningText from '@/utils/ai/reasoningText';
import scoreText from '@/utils/ai/scoreText';

/**
 * A catalog model's grey line for its kind: "9 thumbs up · Uncensored · no reasoning · 0.04¢ a
 * reply", Uncensored only when it counts as uncensored, the reasoning only when the server says
 * it. `score` null reads "Not tried yet"; `score` undefined leaves the score out (an account without
 * scores).
 */
export default function modelDetailText(model, kind, score) {
  const parts = [model.isUncensored && 'Uncensored', reasoningText(model), formatCost(model, kind)].filter(Boolean);
  return (score === undefined ? parts : [scoreText(score, kind), ...parts]).join(' · ');
}
