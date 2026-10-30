import isTurnPassed from './isTurnPassed';

import pluralizeText from '@/utils/pluralizeText';

/**
 * The status of each section of a Verify's `plan` in `run`, as its Conversations row shows it:
 * `icon` (a VerifyStatusIcon status), `text` ("4 of 4 passed", "3 of 5 so far, all passed", "4 turns",
 * "Not reached", "3 of 5, then no answer") and `hasTurns` (it can be opened).
 */
export default function sectionStatuses(plan, run) {
  const results = new Map(run.result?.sections.map((section) => [section.id, section]));
  const turnsOf = (planSection) => results.get(planSection.id)?.turns ?? [];
  // The section running now, or where the run stopped: the first one with turns still to come.
  const current = plan.sections.findIndex((planSection) => turnsOf(planSection).length < planSection.prompts.length);

  return plan.sections.map((planSection, index) => {
    const total = planSection.prompts.length;
    const turns = turnsOf(planSection);
    const passed = turns.filter(isTurnPassed).length;
    const missed = turns.length - passed;
    const status = (icon, text) => ({ icon, text, hasTurns: turns.length > 0 });

    if (run.status === 'done' || index < current || current === -1) {
      return status(missed === 0 ? 'passed' : 'missed', `${passed} of ${turns.length} passed`);
    }
    if (run.status === 'stopped') {
      if (index > current) return status('waiting', 'Not reached');
      return status('stopped', turns.length === 0 ? 'No answer' : `${turns.length} of ${total}, then no answer`);
    }
    if (index > current || turns.length === 0) {
      return status(index === current ? 'running' : 'waiting', pluralizeText('%{count} turn', '%{count} turns', total));
    }
    const so = missed === 0 ? 'all passed' : `${missed} missed`;
    return status('running', `${turns.length} of ${total} so far, ${so}`);
  });
}
