/** US dollars with their cents: "$4.59", "$1.20". */
export default function dollarsText(usd: number): string {
  return `$${usd.toFixed(2)}`;
}
