/** How many of a Verify's `turns` passed: an answer, and every check of it passed. */
export default function countPassed(turns) {
  return turns.filter((turn) => turn.error === null && turn.checks.every((check) => check.ok)).length;
}
