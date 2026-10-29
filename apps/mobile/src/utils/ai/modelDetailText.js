import formatCost from '@/utils/ai/formatCost';
import reasoningText from '@/utils/ai/reasoningText';

/**
 * A catalog model's grey line for its kind after its score (ModelDetail puts the score first), all
 * lower case: "uncensored · vision · reasons · 0.04¢ a reply". It names only what the model has:
 * uncensored when it counts as so, "vision" for a writing model that can see photos, the reasoning
 * when it reasons.
 */
export default function modelDetailText(model, kind) {
  const parts = [
    model.isUncensored && 'uncensored',
    kind === 'writing' && model.supportsVision && 'vision',
    reasoningText(model),
    formatCost(model, kind),
  ].filter(Boolean);
  return parts.join(' · ');
}
