/** How a thread of `count` posts is named where it shows: "3 threads". */
export default function threadLabel(count: number): string {
  return `${count} threads`;
}
