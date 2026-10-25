/**
 * A model's cost line for its kind, from US dollars to cents: "0.04¢ a reply", "2¢ per 100 photos".
 * Ten cents and more are whole, one and more get one decimal, less two, without trailing zeros.
 */
export default function formatCost(model, kind) {
  const isVision = kind === 'vision';
  const cents = (isVision ? model.costPer100PhotosUsd : model.costPerReplyUsd) * 100;
  const digits = cents >= 10 ? 0 : cents >= 1 ? 1 : 2;
  const amount = Number(cents.toFixed(digits)).toString();
  return `${amount}¢ ${isVision ? 'per 100 photos' : 'a reply'}`;
}
