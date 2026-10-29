/**
 * That a model reasons, as Venice reports it (a catalog model's `reasoning`): "reasons", with its
 * default effort when Venice names one ("reasons · effort high"). null for a model that doesn't
 * reason, and when the server doesn't say (one deployed before `reasoning`).
 */
export default function reasoningText({ reasoning }) {
  if (!reasoning || (!reasoning.supported && !reasoning.defaultEffort)) return null;
  return reasoning.defaultEffort ? `reasons · effort ${reasoning.defaultEffort}` : 'reasons';
}
