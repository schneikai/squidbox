import { VERIFY_JUDGE_MODEL_ID, verifyPlanTurns } from '@squidbox/shared';

import findCatalogModel from './findCatalogModel';

import centsText from '@/utils/ai/centsText';
import dollarsText from '@/utils/ai/dollarsText';

/**
 * About what one Verify of `model` for `kind` costs, from the catalog's prices (`catalog` from
 * useAiCatalog, which holds the judge): "about 9.2¢", "under 1¢", "about $1.20". A writing run is a
 * reply of the model and one of the judge for each turn of `plan` (the model's share alone while
 * the judge isn't in the catalog), a vision run a photo for each.
 */
export default function verifyCostText(kind, plan, model, catalog) {
  const turns = verifyPlanTurns(plan);
  const judge = findCatalogModel(catalog, VERIFY_JUDGE_MODEL_ID);
  const usd =
    kind === 'vision'
      ? (turns * model.costPer100PhotosUsd) / 100
      : turns * (model.costPerReplyUsd + (judge?.costPerReplyUsd ?? 0));
  if (usd < 0.01) return 'under 1¢';
  return `about ${usd >= 1 ? dollarsText(usd) : centsText(usd)}`;
}
