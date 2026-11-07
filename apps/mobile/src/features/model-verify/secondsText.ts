/** A duration as Verify shows it: "4.2 s". */
export default function secondsText(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}
