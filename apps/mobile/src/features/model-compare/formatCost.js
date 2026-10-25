/**
 * The cost line of a model, from US dollars to cents: "0.04¢ a reply", "2¢ per 100 photos". Ten
 * cents and more are whole, one and more get one decimal, less two, without trailing zeros.
 */
export default function formatCost(usd, kind) {
  const cents = usd * 100;
  const digits = cents >= 10 ? 0 : cents >= 1 ? 1 : 2;
  const amount = Number(cents.toFixed(digits)).toString();
  return `${amount}¢ ${kind === 'vision' ? 'per 100 photos' : 'a reply'}`;
}
