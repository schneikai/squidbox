/**
 * Why a Verify turn missed, in words: why it got no answer, else the judge's reason when the judge
 * said no, else the first failed check's; null for a turn that passed.
 */
export default function missReason(turn) {
  if (turn.error) return turn.error;
  const failed = turn.checks.filter((check) => !check.ok);
  if (failed.length === 0) return null;
  const judge = failed.find((check) => check.name === 'judge');
  return (judge ?? failed[0]).reason ?? 'a check failed';
}
