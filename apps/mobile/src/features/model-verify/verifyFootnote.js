import { verifyPlanTurns } from '@squidbox/shared';

import pluralizeText from '@/utils/pluralizeText';

/** What a Verify of `kind` does, under the model page's Verify section (`plan` its kind's). */
export default function verifyFootnote(kind, plan) {
  const turns = verifyPlanTurns(plan);
  if (kind === 'vision') {
    return `Verify sends ${pluralizeText('one photo', '%{count} photos', turns)} and checks that tags come back for each.`;
  }
  const conversations = pluralizeText('one conversation', '%{count} conversations', plan.sections.length);
  return `Verify plays ${conversations}, ${turns} turns in all. A judge reads each reply and says whether it did what was asked.`;
}
