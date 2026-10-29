import { VERIFY_TURNS } from '@squidbox/shared';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (count) => WORDS[count] ?? String(count);

/** What a Verify of `kind` does, under the model page's Verify section (`plan` its kind's). */
export default function verifyFootnote(kind, plan) {
  if (kind === 'vision') {
    return `Verify sends ${word(VERIFY_TURNS.vision)} photos and checks that tags come back for each.`;
  }
  return `Verify plays ${word(plan.sections.length)} conversations, ${VERIFY_TURNS.writing} turns in all. A judge reads each reply and says whether it did what was asked.`;
}
