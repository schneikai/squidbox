import countPassed from './countPassed';

/** A model's latest Verify (`run`, null before the first) as its page's status row says it. */
export default function verifyStatusText(run) {
  if (run === null) return 'Not verified yet';
  if (run.status === 'running') return `Verifying… ${run.turnsDone} of ${run.turnsTotal}`;
  if (run.status === 'stopped') return 'Verify stopped';
  const turns = run.result?.sections.flatMap((section) => section.turns) ?? [];
  return `Passed ${countPassed(turns)} of ${run.turnsTotal}`;
}
