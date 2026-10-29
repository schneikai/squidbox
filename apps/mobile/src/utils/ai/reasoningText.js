/**
 * How a model reasons, as Venice reports it (a catalog model's `reasoning`): "reasons" or "no
 * reasoning", and its default effort when Venice names one ("reasons · effort high"). null when the
 * server doesn't say (one deployed before `reasoning`).
 */
export default function reasoningText({ reasoning }) {
  if (!reasoning) return null;
  if (!reasoning.supported && !reasoning.defaultEffort) return 'no reasoning';
  return reasoning.defaultEffort ? `reasons · effort ${reasoning.defaultEffort}` : 'reasons';
}
