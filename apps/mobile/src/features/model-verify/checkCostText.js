import { CHECK_TURNS } from '@squidbox/shared';

// Dollars as the cost lines show them: cents below a dollar ("21¢"), dollars from one up ("$1.20").
function money(usd) {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  const cents = usd * 100;
  return `${Number(cents.toFixed(cents >= 10 ? 0 : cents >= 1 ? 1 : 2))}¢`;
}

/**
 * About what one check of `model` costs, from the catalog's prices: a writing run is CHECK_TURNS
 * replies of the model plus as many of the judge (`judge`, the judge's catalog model; the model's
 * share alone without it), a vision run CHECK_TURNS photos.
 */
export default function checkCostText(kind, model, judge) {
  if (kind === 'vision') return money((CHECK_TURNS.vision * model.costPer100PhotosUsd) / 100);
  return money(CHECK_TURNS.writing * (model.costPerReplyUsd + (judge?.costPerReplyUsd ?? 0)));
}
