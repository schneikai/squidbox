/** How a thread of `count` posts is named where it shows: "Thread · 3". */
export default function threadLabel(count: number): string {
  return `Thread · ${count}`;
}
