/**
 * How a model thinks, from Venice's reasoning capabilities (a catalog model's `reasoning`): "effort
 * high" when Venice names its default effort, "thinks" when it reasons without one, else "no
 * thinking".
 */
export default function thinkingText({ reasoning }) {
  if (reasoning.defaultEffort) return `effort ${reasoning.defaultEffort}`;
  return reasoning.supported ? 'thinks' : 'no thinking';
}
