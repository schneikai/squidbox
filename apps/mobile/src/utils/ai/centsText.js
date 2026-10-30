/**
 * US dollars as cents: "21¢", "2.5¢", "0.04¢". Ten cents and more are whole, one and more get one
 * decimal, less two, without trailing zeros.
 */
export default function centsText(usd) {
  const cents = usd * 100;
  return `${Number(cents.toFixed(cents >= 10 ? 0 : cents >= 1 ? 1 : 2))}¢`;
}
