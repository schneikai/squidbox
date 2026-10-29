import countPassed from './countPassed';

import pluralizeText from '@/utils/pluralizeText';

/**
 * The status of the `index`th section of a Verify's `plan` in `run`, as its Conversations row shows
 * it: `icon` (passed | missed | running | waiting | stopped) and `text` ("4 of 4 passed", "3 of 5 so
 * far, all passed", "4 turns", "Not reached", "3 of 5, then no answer").
 */
export default function sectionStatus(plan, index, run) {
  const results = new Map(run.result?.sections.map((section) => [section.id, section]));
  const turnsOf = (planSection) => results.get(planSection.id)?.turns ?? [];
  // The section running now, or where the run stopped: the first one with turns still to come.
  const current = plan.sections.findIndex((planSection) => turnsOf(planSection).length < planSection.prompts.length);
  const planSection = plan.sections[index];
  const total = planSection.prompts.length;
  const turns = turnsOf(planSection);
  const passed = countPassed(turns);
  const missed = turns.length - passed;

  if (run.status === 'done' || index < current || current === -1) {
    return { icon: missed === 0 ? 'passed' : 'missed', text: `${passed} of ${turns.length} passed` };
  }
  if (run.status === 'stopped') {
    if (index > current) return { icon: 'waiting', text: 'Not reached' };
    return { icon: 'stopped', text: turns.length === 0 ? 'No answer' : `${turns.length} of ${total}, then no answer` };
  }
  if (index > current || turns.length === 0) {
    return {
      icon: index === current ? 'running' : 'waiting',
      text: pluralizeText('%{count} turn', '%{count} turns', total),
    };
  }
  const so = missed === 0 ? 'all passed' : `${missed} missed`;
  return { icon: 'running', text: `${turns.length} of ${total} so far, ${so}` };
}
