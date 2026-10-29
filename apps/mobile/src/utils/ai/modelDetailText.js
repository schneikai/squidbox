import formatCost from '@/utils/ai/formatCost';
import scoreText from '@/utils/ai/scoreText';
import thinkingText from '@/utils/ai/thinkingText';

/**
 * A catalog model's grey line for its kind: "9 thumbs up · Unrestricted · no thinking · 0.04¢ a
 * reply", Unrestricted only when it counts as unrestricted. `score` null reads "Not tried yet"; `score`
 * undefined leaves the score out (an account without scores).
 */
export default function modelDetailText(model, kind, score) {
  const parts = [...(model.isUncensored ? ['Unrestricted'] : []), thinkingText(model), formatCost(model, kind)];
  return (score === undefined ? parts : [scoreText(score, kind), ...parts]).join(' · ');
}
