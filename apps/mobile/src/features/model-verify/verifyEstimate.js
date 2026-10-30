import { VERIFY_JUDGE_MODEL_ID, verifyPlanTurns } from '@squidbox/shared';

import centsText from '@/utils/ai/centsText';
import dollarsText from '@/utils/ai/dollarsText';
import findCatalogModel from '@/utils/ai/findCatalogModel';
import unitCostUsd from '@/utils/ai/unitCostUsd';

/**
 * What one Verify of `model` for `kind` asks for (`plan` the kind's, `catalog` from useAiCatalog,
 * which holds the judge): `turns`, the plan's turns or photos, `judge`, the judge's catalog model
 * (null while it isn't in the catalog), and `costText`, about what it costs: "about 9.2¢", "under
 * 1¢", "about $1.20". A writing run is a reply of the model and one of the judge for each turn (the
 * model's share alone while the judge isn't in the catalog), a vision run a photo for each.
 */
export default function verifyEstimate(kind, plan, model, catalog) {
  const turns = verifyPlanTurns(plan);
  const judge = findCatalogModel(catalog, VERIFY_JUDGE_MODEL_ID);
  const judgeUsd = kind === 'vision' ? 0 : (judge?.costPerReplyUsd ?? 0);
  const usd = turns * (unitCostUsd(model, kind) + judgeUsd);
  const costText = usd < 0.01 ? 'under 1¢' : `about ${usd >= 1 ? dollarsText(usd) : centsText(usd)}`;
  return { turns, judge, costText };
}
