import formatCost from '@/utils/ai/formatCost';
import scoreText from '@/utils/ai/scoreText';
import thinkingText from '@/utils/ai/thinkingText';

/**
 * A catalog model's grey line for its kind: "9 thumbs up · 0.04¢ a reply · no thinking", and
 * "· Unrestricted" when it counts as unrestricted. `score` null reads "Not tried yet"; `score`
 * undefined leaves the score out (an account without scores).
 */
export default function modelDetailText(model, kind, score) {
  const parts = [formatCost(model, kind), thinkingText(model), ...(model.isUncensored ? ['Unrestricted'] : [])];
  return (score === undefined ? parts : [scoreText(score, kind), ...parts]).join(' · ');
}
