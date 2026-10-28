import { CHECK_JUDGE_MODEL_ID, CHECK_TURNS } from '@squidbox/shared';

import checkCostText from './checkCostText';

import confirmAsync from '@/utils/confirmAsync';

/**
 * Whether the admin wants to run `model`'s check of `kind` (a catalog model; `catalog` holds the
 * judge), with what it asks for and about what it costs.
 */
export default function confirmCheckAsync(kind, model, catalog) {
  const judge = catalog?.find(({ id }) => id === CHECK_JUDGE_MODEL_ID);
  const cost = checkCostText(kind, model, judge);
  const asks =
    kind === 'vision'
      ? `${CHECK_TURNS.vision} photos tagged by ${model.name}`
      : `${CHECK_TURNS.writing} replies from ${model.name}, each judged by ${judge?.name ?? CHECK_JUDGE_MODEL_ID}`;
  return confirmAsync({
    title: 'Run check',
    message: `${asks}, about ${cost}. It takes a minute or two.`,
    action: 'Run',
  });
}
