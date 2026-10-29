import { VERIFY_TURNS } from '@squidbox/shared';

import centsText from '@/utils/ai/centsText';

/**
 * About what one Verify of `model` costs, from the catalog's prices: "about 9.2¢", "under 1¢",
 * "about $1.20". A writing run is VERIFY_TURNS replies of the model plus as many of the judge
 * (`judge`, the judge's catalog model; the model's share alone without it), a vision run
 * VERIFY_TURNS photos.
 */
export default function verifyCostText(kind, model, judge) {
  const usd =
    kind === 'vision'
      ? (VERIFY_TURNS.vision * model.costPer100PhotosUsd) / 100
      : VERIFY_TURNS.writing * (model.costPerReplyUsd + (judge?.costPerReplyUsd ?? 0));
  if (usd < 0.01) return 'under 1¢';
  return `about ${usd >= 1 ? `$${usd.toFixed(2)}` : centsText(usd)}`;
}
