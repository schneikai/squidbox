import countPassed from './countPassed';
import missReason from './missReason';

/** The done Verify's one sentence on its misses (`result` the run's, `plan` its kind's). */
export default function missSummary(result, plan, kind) {
  const titles = new Map(plan.sections.map((section) => [section.id, section.title]));
  const missed = result.sections.flatMap((section) =>
    section.turns.filter((turn) => countPassed([turn]) === 0).map((turn) => ({ section, turn })),
  );
  if (kind === 'vision') {
    if (missed.length === 0) return 'Every photo came back with tags. Compare shows how good they are.';
    if (missed.length === 1) return `One photo missed: ${missReason(missed[0].turn)}.`;
    return `${missed.length} photos missed.`;
  }
  if (missed.length === 0) return 'Every reply did what was asked.';
  if (missed.length === 1) {
    const [{ section, turn }] = missed;
    return `Missed once: ${missReason(turn)} in ${titles.get(section.id) ?? section.title}.`;
  }
  const where = [...new Set(missed.map(({ section }) => titles.get(section.id) ?? section.title))];
  const list = where.length === 1 ? where[0] : `${where.slice(0, -1).join(', ')} and ${where.at(-1)}`;
  return `Missed ${missed.length} turns, in ${list}.`;
}
