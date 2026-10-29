import isTurnPassed from './isTurnPassed';
import secondsText from './secondsText';
import turnUnit from './turnUnit';

import relativeTime from '@/utils/relativeTime';

/**
 * A model's latest Verify of `kind` (`run`, null before the first) in words, as the model page's
 * status row and the top of the Verify page say it: `title` ("Not verified yet", "Verifying… 7 of
 * 21", "Verify stopped", "Passed 20 of 21"), `detail` (done: "2 h ago · 0.8 s a reply"; stopped:
 * "just now · at turn 8 of 21"; null otherwise) and `icon` (a VerifyStatusIcon status, null before
 * the first run).
 */
export default function verifySummary(kind, run) {
  if (run === null) return { title: 'Not verified yet', detail: null, icon: null };
  if (run.status === 'running') {
    return { title: `Verifying… ${run.turnsDone} of ${run.turnsTotal}`, detail: null, icon: 'running' };
  }
  const unit = turnUnit(kind);
  const when = relativeTime(Date.parse(run.finishedAt ?? run.startedAt));
  if (run.status === 'stopped') {
    return {
      title: 'Verify stopped',
      detail: `${when} · at ${unit.one} ${run.turnsDone + 1} of ${run.turnsTotal}`,
      icon: 'stopped',
    };
  }
  const turns = run.result?.sections.flatMap((section) => section.turns) ?? [];
  const passed = turns.filter(isTurnPassed).length;
  return {
    title: `Passed ${passed} of ${run.turnsTotal}`,
    detail: `${when} · ${secondsText(run.result?.medianSeconds ?? 0)} ${unit.each}`,
    icon: passed < turns.length ? 'missed' : 'passed',
  };
}
