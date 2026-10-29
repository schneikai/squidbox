/**
 * How a model reasons, as Venice reports it (a catalog model's `reasoning`): "reasons" or "no
 * reasoning", and its default effort when Venice names one ("reasons · effort high").
 */
export default function reasoningText({ reasoning }) {
  if (!reasoning.supported && !reasoning.defaultEffort) return 'no reasoning';
  return reasoning.defaultEffort ? `reasons · effort ${reasoning.defaultEffort}` : 'reasons';
}
